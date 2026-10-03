"""Billing of an Enterprise client's later business units (plans/plan.md Step 10).

An Enterprise client's BUs share one plan and one paid_through. The first
`enterprise_included_bus` BUs are in the plan (BU 1 carries the Enterprise fee, the
rest 0); each later BU adds `extra_bu_monthly` to the client's monthly fee and needs an
explicit confirmation. If the client is prepaid beyond today, the shared paid_through is
rebased from the old total fee to the new one (constraint 8) and a zero-amount ledger row
records it.

Called by resolve_create_bu_schema_and_feed_seed_data_helper for a new BU in any database
other than the default customer database, once that database already has a billed BU.
"""

from dataclasses import dataclass
from datetime import date

from app.core.audit_log import AuditAction, audit_logger
from app.core.billing import rebase_paid_through, today_ist
from app.core.exceptions import AppMessages, CodedValidationException
from app.core.plan_prices import get_price_list
from app.db.connection.psycopg_driver import exec_sql
from app.db.sql.sql_billing import BillingServerSql
from app.services.bu_billing import clear_bu_billing
from app.services.default_customer import get_enterprise_enquiry_notify_email, is_default_customer_db
from app.services.signup_emails import rupees, send_text_email


@dataclass(frozen=True)
class NewBuBillingType:
    """How a new BU of a billed client is billed."""

    bu_number: int
    fee_paise: int
    included: int
    old_paid_through: date | None
    old_total_paise: int
    paid_through: date | None
    template: dict

    @property
    def is_extra(self) -> bool:
        return self.fee_paise > 0

    @property
    def new_total_paise(self) -> int:
        return self.old_total_paise + self.fee_paise


async def plan_new_bu_billing(db_name: str, confirm_extra_bu: bool) -> NewBuBillingType | None:
    """None when the new BU is not billed (the default database, or no billed BU yet).
    Raises EXTRA_BU_CONFIRM_REQUIRED, with the new paid_through, for an unconfirmed extra BU."""
    if is_default_customer_db(db_name):
        return None
    rows = await exec_sql(db_name, "security", BillingServerSql.GET_BU_BILLING_ROWS)
    billed = [r for r in rows if r["billing_required"]]
    if not billed:
        return None

    prices = get_price_list()
    bu_number = len(rows) + 1
    included = prices.enterprise_included_bus
    fee_paise = prices.extra_bu_monthly_paise if bu_number > included else 0
    old_total = sum(r["monthly_fee_paise"] or 0 for r in billed)
    template = billed[0]
    paid_through = rebase_paid_through(template["paid_through"], today_ist(), old_total, old_total + fee_paise)
    plan = NewBuBillingType(
        bu_number=bu_number,
        fee_paise=fee_paise,
        included=included,
        old_paid_through=template["paid_through"],
        old_total_paise=old_total,
        paid_through=paid_through,
        template=template,
    )
    if plan.is_extra and not confirm_extra_bu:
        raise CodedValidationException(
            message=AppMessages.EXTRA_BU_CONFIRM_REQUIRED.format(
                fee=rupees(fee_paise).lstrip("₹"), included=included
            ),
            code="EXTRA_BU_CONFIRM_REQUIRED",
            extensions={
                "fee_paise": fee_paise,
                "paid_through": paid_through.isoformat() if paid_through else None,
                "paid_through_changes": paid_through != template["paid_through"],
            },
        )
    return plan


async def apply_new_bu_billing(db_name: str, bu_id: int, bu_code: str, plan: NewBuBillingType) -> None:
    """Copy the client's plan and dates to the new BU; rebase and record a fee change; tell
    the team about an extra BU."""
    t = plan.template
    await exec_sql(
        db_name,
        "security",
        BillingServerSql.COPY_CLIENT_BILLING_TO_BU,
        {
            "billing_hold": t["billing_hold"],
            "billing_required": t["billing_required"],
            "branch_limit": t["branch_limit"],
            "bu_id": bu_id,
            "monthly_fee_paise": plan.fee_paise,
            "paid_through": plan.paid_through,
            "plan_code": t["plan_code"],
        },
    )
    clear_bu_billing(db_name)
    if not plan.is_extra:
        return

    rebase_note = ""
    if plan.paid_through != plan.old_paid_through:
        await exec_sql(db_name, "security", BillingServerSql.SET_CLIENT_PAID_THROUGH, {"paid_through": plan.paid_through})
        rebase_note = f" Prepaid period now ends {plan.paid_through} (was {plan.old_paid_through})."
        await exec_sql(
            db_name,
            "security",
            BillingServerSql.INSERT_FEE_REBASE,
            {
                "bu_id": bu_id,
                "monthly_fee_paise": plan.new_total_paise,
                "note": (
                    f"Extra BU {bu_code}: client fee {rupees(plan.old_total_paise)} → "
                    f"{rupees(plan.new_total_paise)}; paid_through {plan.old_paid_through} → {plan.paid_through}"
                ),
                "recorded_by": "system",
            },
        )

    client_name = db_name
    text = AppMessages.SIGNUP_EMAIL_EXTRA_BU_TEXT.format(
        bu_code=bu_code,
        bu_number=plan.bu_number,
        client_name=client_name,
        db_name=db_name,
        fee=rupees(plan.fee_paise).lstrip("₹"),
        included=plan.included,
        rebase=rebase_note,
        total=rupees(plan.new_total_paise).lstrip("₹"),
    )
    await send_text_email(
        get_enterprise_enquiry_notify_email(),
        AppMessages.SIGNUP_EMAIL_EXTRA_BU_SUBJECT.format(bu_code=bu_code, client_name=client_name),
        text,
    )
    await audit_logger.log(
        action=AuditAction.EXTRA_BU_ADDED,
        actor_type="admin",
        actor_username=db_name,
        detail=text,
        resource_name=bu_code,
        resource_type="bu",
    )

