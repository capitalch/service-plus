"""
Public, read-only REST API for the marketing website (service-plus-web).

Endpoints:
    GET /api/public/companies   - Dropdown list of companies (BUs across active clients)
    GET /api/public/job-status  - Single job lookup by job_no + mobile

Every route here is guarded by require_website_key (X-Website-Key header) and
per-IP rate limiting. No amounts and no internal ids are ever returned — see
plans/plan.md §3 and app/db/sql/sql_public.py for the column whitelist.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.core.dependencies import require_website_key
from app.core.rate_limit import rate_limit
from app.db.connection.psycopg_driver import exec_sql_query
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
    device_details: str | None
    branch_name: str | None


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
        device_details=row["device_details"],
        branch_name=row["branch_name"],
    )
