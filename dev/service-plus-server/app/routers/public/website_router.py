"""
Public, read-only REST API for the marketing website (service-plus-web).

Endpoints:
    GET /api/public/companies    - Dropdown list of companies (BUs across active clients)
    GET /api/public/job-status   - Single job lookup by job_no + mobile
    GET /api/public/open-jobs    - All open jobs for a customer, looked up by mobile alone
    GET /api/public/branches     - Active branches for a company (spare-parts catalogue)
    GET /api/public/company-info - Support phone + branch name for a (company, branch) pair
    GET /api/public/parts        - Paginated spare-parts catalogue for a (company, branch)
    GET /api/public/parts/{id}   - Single catalogue part, with its full photo gallery
    POST /api/public/part-orders - Submit a spare-parts order request (no payment, §7)

Every route here is guarded by require_website_key (X-Website-Key header) and
per-IP rate limiting. No amounts and no internal ids are ever returned — see
plans/plan.md §3 and app/db/sql/sql_public.py for the column whitelist. The
spare-parts routes are the one exception to "no amounts": `price` is the
catalogue price being browsed, not an internal accounting figure — see
plans/plan-parts-web.md §5.
"""
from dataclasses import dataclass

import psycopg.sql as pgsql
from fastapi import APIRouter, Depends, HTTPException, Query, status
from psycopg.rows import dict_row
from pydantic import BaseModel, Field

from app.core.dependencies import require_website_key
from app.core.email import send_email
from app.core.rate_limit import rate_limit
from app.db.connection.psycopg_driver import exec_sql_query, get_service_db_connection
from app.db.sql.sql_base import SqlStore
from app.db.sql.sql_public import PublicSql
from app.logger import logger
from app.services.public_directory import public_directory

router = APIRouter(
    prefix="/api/public",
    tags=["public"],
    dependencies=[Depends(require_website_key)],
)


class CompanyOut(BaseModel):
    id: str
    label: str


class JobStatusOut(BaseModel):
    job_no: str
    job_date: str | None
    delivery_date: str | None
    is_closed: bool
    status: str
    status_code: str
    status_description: str | None
    device_details: str | None
    serial_no: str | None


class CustomerJobsOut(BaseModel):
    customer_name: str
    jobs: list[JobStatusOut]


class BranchOut(BaseModel):
    code: str
    name: str
    city: str | None
    is_head_office: bool


class CompanyInfoOut(BaseModel):
    support_phone: str | None
    branch_name: str


class PartOut(BaseModel):
    id: int
    part_name: str
    part_description: str | None
    price: float
    model: str | None
    image_url: str | None


class PartsListOut(BaseModel):
    items: list[PartOut]
    total: int
    page: int
    page_size: int


class PartDetailOut(PartOut):
    images: list[str]


class PartOrderLineIn(BaseModel):
    part_id: int
    qty: int = Field(gt=0)


class PartOrderIn(BaseModel):
    company: str = Field(min_length=1)
    branch: str | None = Field(default=None, min_length=1, max_length=50)
    customer_name: str = Field(min_length=1, max_length=200)
    mobile: str = Field(pattern=r"^\d{10}$")
    email: str | None = Field(default=None, max_length=200, pattern=r"^.+@.+\..+$")
    remarks: str | None = Field(default=None, max_length=1000)
    lines: list[PartOrderLineIn] = Field(min_length=1, max_length=100)


class PartOrderOut(BaseModel):
    order_id: int
    status: str


# ─── Branch resolution — shared by every spare-parts route below ──────────────


@dataclass(frozen=True)
class _Branch:
    id: int
    code: str
    name: str
    phone: str | None
    email: str | None
    city: str | None
    is_head_office: bool


async def _get_active_branches(db_name: str, schema: str) -> list[_Branch]:
    rows = await exec_sql_query(db_name=db_name, schema=schema, sql=PublicSql.GET_ACTIVE_BRANCHES)
    return [_Branch(**row) for row in rows]


async def resolve_branch(
    db_name: str,
    schema: str,
    branch_code: str | None,
    branches: list[_Branch] | None = None,
) -> _Branch:
    """
    Resolve a branch_code to an active Branch row within the given tenant schema.

    - branch_code omitted -> the first active branch (head-office first, then code
      order — the query's own ORDER BY). This is the "default the first branch" rule:
      a single-branch tenant's frontend can simply never send `branch` at all.
    - branch_code supplied but not an active branch of *this* tenant -> 404. The
      company token already pins (db_name, schema), so a forged branch can at worst
      name a branch inside the tenant the caller already selected — and that's
      rejected too unless it resolves to an active branch.

    Pass `branches` when the caller already fetched the active-branch list (e.g.
    company-info also needs it for the phone-fallback chain) to avoid a second query.
    """
    if branches is None:
        branches = await _get_active_branches(db_name, schema)
    if not branches:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active branch found")

    if not branch_code:
        return branches[0]

    normalized = branch_code.strip().upper()
    for branch in branches:
        if branch.code == normalized:
            return branch

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown branch")


@router.get(
    "/companies",
    response_model=list[CompanyOut],
    dependencies=[Depends(rate_limit("companies", limit=30, window_seconds=60))],
)
async def list_companies() -> list[CompanyOut]:
    """Return the public company (business unit) dropdown list."""
    companies = await public_directory.list_companies()
    return [CompanyOut(id=c.id, label=c.label) for c in companies]


@router.get(
    "/job-status",
    response_model=JobStatusOut,
    dependencies=[Depends(rate_limit("job-status", limit=5, window_seconds=60))],
)
async def get_job_status(
    company: str = Query(..., min_length=1),
    job_no: str = Query(..., min_length=1, max_length=100),
    mobile: str = Query(..., min_length=10, max_length=10, pattern=r"^\d{10}$"),
) -> JobStatusOut:
    """Look up one job by its exact job number and the customer's mobile number."""
    resolved = await public_directory.resolve_company(company)
    if resolved is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown company")
    db_name, bu_code = resolved

    rows = await exec_sql_query(
        db_name=db_name,
        schema=bu_code.lower(),
        sql=PublicSql.GET_PUBLIC_JOB_STATUS,
        sql_args={"job_no": job_no, "mobile": mobile},
        text_dates=True,
    )
    if not rows:
        logger.info("Public job-status lookup miss for job_no=%s", job_no)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    row = rows[0]
    return JobStatusOut(
        job_no=row["job_no"],
        job_date=row["job_date"],
        delivery_date=row["delivery_date"],
        is_closed=row["is_closed"],
        status=row["job_status_name"],
        status_code=row["status_code"],
        status_description=row["status_description"],
        device_details=row["device_details"],
        serial_no=row["serial_no"],
    )


@router.get(
    "/open-jobs",
    response_model=CustomerJobsOut,
    dependencies=[Depends(rate_limit("open-jobs", limit=5, window_seconds=60))],
)
async def get_open_jobs_by_mobile(
    company: str = Query(..., min_length=1),
    mobile: str = Query(..., min_length=10, max_length=10, pattern=r"^\d{10}$"),
) -> CustomerJobsOut:
    """Look up a customer by mobile number and return all of their open jobs."""
    resolved = await public_directory.resolve_company(company)
    if resolved is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown company")
    db_name, bu_code = resolved

    rows = await exec_sql_query(
        db_name=db_name,
        schema=bu_code.lower(),
        sql=PublicSql.GET_PUBLIC_OPEN_JOBS_BY_MOBILE,
        sql_args={"mobile": mobile},
        text_dates=True,
    )
    if not rows:
        logger.info("Public open-jobs lookup miss for mobile lookup")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No open jobs found")

    return CustomerJobsOut(
        customer_name=rows[0]["customer_name"],
        jobs=[
            JobStatusOut(
                job_no=row["job_no"],
                job_date=row["job_date"],
                delivery_date=row["delivery_date"],
                is_closed=row["is_closed"],
                status=row["job_status_name"],
                status_code=row["status_code"],
                status_description=row["status_description"],
                device_details=row["device_details"],
                serial_no=row["serial_no"],
            )
            for row in rows
        ],
    )


@router.get(
    "/branches",
    response_model=list[BranchOut],
    dependencies=[Depends(rate_limit("branches", limit=30, window_seconds=60))],
)
async def list_branches(company: str = Query(..., min_length=1)) -> list[BranchOut]:
    """
    Active branches for a company, head-office-first then code order (§5).

    This is what drives the show/hide rule one level below the company picker:
    the frontend fetches it once per company selection — exactly one branch means
    no dropdown is rendered at all, more than one means a dropdown preselected to
    the first result.
    """
    resolved = await public_directory.resolve_company(company)
    if resolved is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown company")
    db_name, bu_code = resolved

    branches = await _get_active_branches(db_name, bu_code.lower())
    return [
        BranchOut(code=b.code, name=b.name, city=b.city, is_head_office=b.is_head_office)
        for b in branches
    ]


@router.get(
    "/company-info",
    response_model=CompanyInfoOut,
    dependencies=[Depends(rate_limit("company-info", limit=30, window_seconds=60))],
)
async def get_company_info(
    company: str = Query(..., min_length=1),
    branch: str | None = Query(default=None, min_length=1, max_length=50),
) -> CompanyInfoOut:
    """
    Support phone + name for the selected branch (§7): the branch's own phone,
    falling back to the head-office branch's, then to the first active branch's.
    """
    resolved = await public_directory.resolve_company(company)
    if resolved is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown company")
    db_name, bu_code = resolved
    schema = bu_code.lower()

    branches = await _get_active_branches(db_name, schema)
    target = await resolve_branch(db_name, schema, branch, branches=branches)

    support_phone = target.phone
    if not support_phone:
        head_office = next((b for b in branches if b.is_head_office), None)
        support_phone = head_office.phone if head_office else None
    if not support_phone:
        support_phone = branches[0].phone

    return CompanyInfoOut(support_phone=support_phone, branch_name=target.name)


@router.get(
    "/parts",
    response_model=PartsListOut,
    dependencies=[Depends(rate_limit("parts", limit=60, window_seconds=60))],
)
async def list_parts(
    company: str = Query(..., min_length=1),
    branch: str | None = Query(default=None, min_length=1, max_length=50),
    search: str = Query(default="", max_length=200),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=50),
) -> PartsListOut:
    """Paginated, branch-scoped spare-parts catalogue (§5). `image_url` is the cover
    only (`image_urls[1]`) — the full gallery is only shipped by the detail route."""
    resolved = await public_directory.resolve_company(company)
    if resolved is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown company")
    db_name, bu_code = resolved
    schema = bu_code.lower()

    target = await resolve_branch(db_name, schema, branch)
    offset = (page - 1) * page_size
    search_term = search.strip()

    rows = await exec_sql_query(
        db_name=db_name,
        schema=schema,
        sql=PublicSql.GET_SPARE_PART_WEB_PUBLIC_LIST,
        sql_args={"branch_id": target.id, "search": search_term, "limit": page_size, "offset": offset},
    )
    count_rows = await exec_sql_query(
        db_name=db_name,
        schema=schema,
        sql=PublicSql.GET_SPARE_PART_WEB_PUBLIC_LIST_COUNT,
        sql_args={"branch_id": target.id, "search": search_term},
    )
    total = count_rows[0]["total"] if count_rows else 0

    return PartsListOut(
        items=[PartOut(**row) for row in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/parts/{part_id}",
    response_model=PartDetailOut,
    dependencies=[Depends(rate_limit("part-detail", limit=60, window_seconds=60))],
)
async def get_part_detail(
    part_id: int,
    company: str = Query(..., min_length=1),
    branch: str | None = Query(default=None, min_length=1, max_length=50),
) -> PartDetailOut:
    """Single catalogue part with its full photo gallery, already in display order
    straight off `image_urls` — no second query, no join (§3c/§5). 404 if the part
    doesn't exist, is inactive, or belongs to a different branch than resolved."""
    resolved = await public_directory.resolve_company(company)
    if resolved is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown company")
    db_name, bu_code = resolved
    schema = bu_code.lower()

    target = await resolve_branch(db_name, schema, branch)

    rows = await exec_sql_query(
        db_name=db_name,
        schema=schema,
        sql=PublicSql.GET_SPARE_PART_WEB_PUBLIC_DETAIL,
        sql_args={"id": part_id, "branch_id": target.id},
    )
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Part not found")

    return PartDetailOut(**rows[0])


# ─── Order submission ──────────────────────────────────────────────────────────


async def _insert_part_order(
    db_name: str,
    schema: str,
    branch_id: int,
    customer_name: str,
    mobile: str,
    email: str | None,
    remarks: str | None,
    total_amount: float,
    lines: list[dict],
) -> int:
    """Insert the order header + all its lines in one transaction (header id feeds
    the lines' FK, so this can't be expressed as independent exec_sql* calls —
    manual cursor use on one connection, same primitives exec_sql itself uses)."""
    async with get_service_db_connection(db_name) as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                pgsql.SQL("SET search_path TO {}").format(pgsql.Identifier(schema))
            )
            await cur.execute(
                PublicSql.INSERT_SPARE_PART_WEB_ORDER,
                {
                    "branch_id": branch_id,
                    "customer_name": customer_name,
                    "mobile": mobile,
                    "email": email,
                    "remarks": remarks,
                    "total_amount": total_amount,
                },
            )
            order_row = await cur.fetchone()
            order_id = order_row["id"]
            for line in lines:
                await cur.execute(
                    PublicSql.INSERT_SPARE_PART_WEB_ORDER_LINE,
                    {"order_id": order_id, **line},
                )
    return order_id


async def _resolve_notify_email(
    db_name: str, schema: str, target: _Branch, branches: list[_Branch]
) -> str | None:
    """Branch-first recipient resolution (§7): the ordered-from branch's own email,
    then a per-BU app-setting, then the head-office branch's email."""
    if target.email:
        return target.email

    setting_rows = await exec_sql_query(
        db_name=db_name,
        schema=schema,
        sql=SqlStore.GET_APP_SETTING_BY_KEY,
        sql_args={"setting_key": "web_order_notify_email"},
    )
    setting_value = setting_rows[0]["setting_value"] if setting_rows else None
    if setting_value:
        return setting_value

    head_office = next((b for b in branches if b.is_head_office), None)
    return head_office.email if head_office else None


async def _notify_staff_of_order(
    db_name: str,
    schema: str,
    target: _Branch,
    branches: list[_Branch],
    order_id: int,
    total_amount: float,
) -> None:
    """Best-effort staff notification — never blocks or fails order submission.
    An order row with no email sent is recoverable from the DB; a lost order is not."""
    recipient = await _resolve_notify_email(db_name, schema, target, branches)
    if not recipient:
        logger.warning(
            "No notification email resolved for spare-parts order #%s (branch=%s)",
            order_id,
            target.code,
        )
        return

    subject = f"New web parts order #{order_id} — {target.code}"
    body = (
        f"A new spare-parts order has been placed for {target.name} ({target.code}).\n\n"
        f"Order #: {order_id}\n"
        f"Total (indicative): {total_amount:.2f}\n\n"
        "Log in to the admin app to view full order details and contact the customer."
    )
    try:
        await send_email(to=recipient, subject=subject, body=body)
    except Exception as mail_err:  # pylint: disable=broad-except
        logger.warning(
            "Failed to send notification email for spare-parts order #%s: %s",
            order_id,
            mail_err,
        )


@router.post(
    "/part-orders",
    response_model=PartOrderOut,
    dependencies=[Depends(rate_limit("part-orders", limit=10, window_seconds=60))],
)
async def submit_part_order(payload: PartOrderIn) -> PartOrderOut:
    """
    Submit a spare-parts order request — the entire "checkout" (§7): no payment
    gateway, no automated fulfillment. Every line is re-validated against the
    resolved branch and re-priced from the current `spare_part_web.price`; the
    client's cached price is never trusted. An order never spans two branches —
    every line must belong to the resolved branch or the whole submission is
    rejected (§3b).
    """
    resolved = await public_directory.resolve_company(payload.company)
    if resolved is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown company")
    db_name, bu_code = resolved
    schema = bu_code.lower()

    branches = await _get_active_branches(db_name, schema)
    target = await resolve_branch(db_name, schema, payload.branch, branches=branches)

    requested_ids = list({line.part_id for line in payload.lines})
    rows = await exec_sql_query(
        db_name=db_name,
        schema=schema,
        sql=PublicSql.GET_SPARE_PART_WEB_FOR_ORDER,
        sql_args={"ids": requested_ids},
    )
    candidates = {row["id"]: row for row in rows}

    errors: list[str] = []
    order_lines: list[dict] = []
    total_amount = 0.0

    for line in payload.lines:
        part = candidates.get(line.part_id)
        if part is None:
            errors.append(f"Part {line.part_id} not found")
        elif not part["is_active"]:
            errors.append(f"Part {line.part_id} is no longer available")
        elif part["branch_id"] != target.id:
            errors.append(f"Part {line.part_id} does not belong to the selected branch")
        else:
            unit_price = float(part["price"])
            line_total = round(unit_price * line.qty, 2)
            total_amount += line_total
            order_lines.append({
                "spare_part_web_id": line.part_id,
                "qty": line.qty,
                "unit_price": unit_price,
                "line_total": line_total,
            })

    if errors:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=errors)

    total_amount = round(total_amount, 2)

    order_id = await _insert_part_order(
        db_name=db_name,
        schema=schema,
        branch_id=target.id,
        customer_name=payload.customer_name.strip(),
        mobile=payload.mobile,
        email=payload.email,
        remarks=payload.remarks,
        total_amount=total_amount,
        lines=order_lines,
    )

    await _notify_staff_of_order(db_name, schema, target, branches, order_id, total_amount)

    return PartOrderOut(order_id=order_id, status="NEW")
