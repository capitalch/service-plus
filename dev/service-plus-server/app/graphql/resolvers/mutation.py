"""
GraphQL Mutation resolvers.
"""

import json
from typing import Any
from urllib.parse import unquote
from ariadne import MutationType  # pylint: disable=import-error
from app.core.exceptions import AppMessages
from app.graphql.resolvers.auth_guards import require_access_right, require_any_access_right
from app.graphql.resolvers.error_handling import handle_graphql_errors

from app.graphql.resolvers.bu_admin.mailers import (
    resolve_mail_admin_credentials_helper,
    resolve_mail_business_user_credentials_helper,
)
from app.graphql.resolvers.bu_admin.provisioning import (
    BU_ADMIN_GENERIC_UPDATE_TABLE_RIGHTS,
    resolve_create_bu_schema_and_feed_seed_data_helper,
    resolve_create_client_helper,
    resolve_create_service_db_helper,
    resolve_delete_bu_schema_helper,
    resolve_delete_client_helper,
    resolve_drop_database_helper,
    resolve_feed_bu_seed_data_helper,
    resolve_seed_security_data_helper,
)
from app.graphql.resolvers.bu_admin.users_roles import (
    resolve_create_admin_user_helper,
    resolve_create_business_user_helper,
    resolve_set_user_bu_role_helper,
)
from app.graphql.resolvers.inventory.mutations import (
    INVENTORY_GENERIC_UPDATE_SCRIPT_SQL_ID_RIGHTS,
    INVENTORY_GENERIC_UPDATE_TABLE_RIGHTS,
    resolve_delete_unused_parts_by_brand_helper,
    resolve_import_spare_parts_helper,
)
from app.graphql.resolvers.jobs.invoicing import (
    resolve_create_job_invoice_helper,
    resolve_regenerate_job_invoice_helper,
)
from app.graphql.resolvers.jobs.mutations import (
    JOBS_GENERIC_UPDATE_SCRIPT_SQL_ID_RIGHTS,
    JOBS_GENERIC_UPDATE_TABLE_RIGHTS,
    resolve_create_job_batch_helper,
    resolve_create_job_payment_helper,
    resolve_create_single_job_helper,
    resolve_deliver_job_helper,
    resolve_delete_job_batch_helper,
    resolve_undeliver_job_helper,
    resolve_undo_job_transaction_helper,
    resolve_update_job_batch_helper,
    resolve_update_job_helper,
    resolve_update_opening_job_helper,
)
from app.whatsapp.sender import (
    resolve_send_whatsapp_completion_helper,
    send_job_creation_notice,
    send_job_delivery_notice,
    send_whatsapp_job_invoice,
    send_whatsapp_money_receipt,
    set_job_delivery_manual_confirmation,
    verify_job_delivery_otp,
)
from app.graphql.resolvers.sales_accounts.mutations import (
    resolve_accounts_posting_helper,
    resolve_create_sales_invoice_helper,
)
from app.graphql.resolvers.shared.generic_update import (
    resolve_generic_update_helper,
    resolve_generic_update_script_helper,
)
# from app.graphql.pubsub import pubsub


# Create MutationType instance
mutation = MutationType()


# genericUpdate writes to any table by name (`tableName` in the decoded
# `value` payload), so the access-right check has to key off that name
# rather than off a dedicated resolver. Only tables owned exclusively by
# one gated feature are listed here — tables shared with unrestricted
# areas (e.g. "job", written by Single/Batch/Opening Job and Job Control
# alike; "job_payment", written by both Receipts and the Deliver-Job
# payment step) are deliberately NOT included, since gating them by
# tableName alone would also block roles from legitimately-unrestricted
# Jobs/Inventory flows that happen to write the same table. See the Step 10
# note in plans/plan-access-control.md. The stock_* / job_invoice entries
# below were verified exclusive to their feature in plans/plan.md's
# "Server-side enforcement feasibility" section — the shared `stock_transaction`
# table itself is deliberately NOT listed, since it's only ever a nested
# xDetails write reached through one of these feature-specific top-level
# tables (including "stock_loan" for Loan Entry, which stays ungated).
#
# Each domain owns its own slice of this mapping (see plans/plan.md Step 4.6 /
# item 13) — merged here since genericUpdate is a single cross-domain dispatcher.
GENERIC_UPDATE_TABLE_RIGHTS: dict[str, str] = {
    **JOBS_GENERIC_UPDATE_TABLE_RIGHTS,
    **INVENTORY_GENERIC_UPDATE_TABLE_RIGHTS,
    **BU_ADMIN_GENERIC_UPDATE_TABLE_RIGHTS,
}

# genericUpdateScript executes a named SqlStore query by sql_id (not a
# tableName), so it needs its own, separately-keyed rights dict. Being keyed
# per sql_id, a right here gates exactly one operation and no other caller of
# the same table — which is why job cost correction lives here rather than in
# GENERIC_UPDATE_TABLE_RIGHTS (see plans/plan.md Step 6). Each domain owns its
# own slice, merged here since genericUpdateScript is a single dispatcher.
GENERIC_UPDATE_SCRIPT_SQL_ID_RIGHTS: dict[str, str] = {
    **JOBS_GENERIC_UPDATE_SCRIPT_SQL_ID_RIGHTS,
    **INVENTORY_GENERIC_UPDATE_SCRIPT_SQL_ID_RIGHTS,
}


def _require_generic_update_table_right(info, value: str) -> None:
    """Gate genericUpdate calls that target a table listed in GENERIC_UPDATE_TABLE_RIGHTS."""
    try:
        table_name = json.loads(unquote(value)).get("tableName")
    except (ValueError, AttributeError):
        return
    right = GENERIC_UPDATE_TABLE_RIGHTS.get(table_name)
    if right:
        require_access_right(info, right)


def _require_generic_update_script_right(info, value: str) -> None:
    """Gate genericUpdateScript calls whose sql_id is listed in GENERIC_UPDATE_SCRIPT_SQL_ID_RIGHTS."""
    try:
        sql_id = json.loads(unquote(value)).get("sql_id")
    except (ValueError, AttributeError):
        return
    right = GENERIC_UPDATE_SCRIPT_SQL_ID_RIGHTS.get(sql_id)
    if right:
        require_access_right(info, right)


@mutation.field("createAdminUser")
@handle_graphql_errors("Error creating admin user")
async def resolve_create_admin_user(
    _, info, db_name: str = "", schema: str = "security", value: str = ""
) -> Any:
    """Create an admin user and email a password-reset link."""
    return await resolve_create_admin_user_helper(
        db_name, schema, value, request=info.context.get("request")
    )


@mutation.field("createBuSchemaAndFeedSeedData")
@handle_graphql_errors("Error creating BU schema", AppMessages.BU_SCHEMA_CREATE_FAILED)
async def resolve_create_bu_schema_and_feed_seed_data(
    _, _info, db_name: str = "", schema: str = "security", value: str = ""
) -> Any:
    """Create a BU schema and seed its lookup tables."""
    return await resolve_create_bu_schema_and_feed_seed_data_helper(db_name, schema, value)


@mutation.field("createClient")
@handle_graphql_errors("Error creating client")
async def resolve_create_client(
    _, _info, db_name: str = "", schema: str = "public", value: str = ""
) -> Any:
    """Insert a new client record."""
    return await resolve_create_client_helper(db_name, schema, value)


@mutation.field("createBusinessUser")
@handle_graphql_errors("Error creating business user")
async def resolve_create_business_user(
    _, info, db_name: str = "", schema: str = "security", value: str = ""
) -> Any:
    """Create a business user in the security schema."""
    return await resolve_create_business_user_helper(
        db_name, schema, value, request=info.context.get("request")
    )


@mutation.field("createServiceDb")
@handle_graphql_errors("Error creating service database")
async def resolve_create_service_db(
    _, _info, db_name: str = "", schema: str = "security", value: str = ""
) -> Any:
    """Create a new PostgreSQL service database for a client."""
    return await resolve_create_service_db_helper(db_name, schema, value)


@mutation.field("feedBuSeedData")
@handle_graphql_errors("Error feeding BU seed data", AppMessages.BU_SEED_FEED_FAILED)
async def resolve_feed_bu_seed_data(
    _, _info, db_name: str = "", schema: str = "security", value: str = ""
) -> Any:
    """Feed seed data into an existing BU schema."""
    return await resolve_feed_bu_seed_data_helper(db_name, schema, value)


@mutation.field("seedSecurityData")
@handle_graphql_errors("Error seeding security data", AppMessages.SECURITY_SEED_FEED_FAILED)
async def resolve_seed_security_data(
    _, _info, db_name: str = "", schema: str = "security", value: str = ""
) -> Any:
    """Feed seed data into an existing client's security schema."""
    return await resolve_seed_security_data_helper(db_name, schema, value)


@mutation.field("deleteBuSchema")
@handle_graphql_errors("Error dropping BU schema", AppMessages.BU_SCHEMA_DROP_FAILED)
async def resolve_delete_bu_schema(
    _, _info, db_name: str = "", schema: str = "security", value: str = ""
) -> Any:
    """Drop a BU schema and optionally delete its security.bu row."""
    return await resolve_delete_bu_schema_helper(db_name, schema, value)


@mutation.field("deleteClient")
@handle_graphql_errors("Error deleting client")
async def resolve_delete_client(
    _, _info, db_name: str = "", schema: str = "security", value: str = ""
) -> Any:
    """Guard inactive state, drop client database, delete client row."""
    return await resolve_delete_client_helper(db_name, schema, value)


@mutation.field("dropDatabase")
@handle_graphql_errors("Error dropping database", AppMessages.DB_DROP_FAILED)
async def resolve_drop_database(
    _, _info, db_name: str = "", schema: str = "security", value: str = ""
) -> Any:
    """Physically drop an orphan PostgreSQL database."""
    return await resolve_drop_database_helper(db_name, schema, value)


@mutation.field("genericUpdate")
@handle_graphql_errors("Error in genericUpdate")
async def resolve_generic_update(_, info, db_name="", schema="public", value="") -> Any:
    """Execute a generic table upsert/delete operation."""
    _require_generic_update_table_right(info, value)
    return await resolve_generic_update_helper(db_name, schema, value)


@mutation.field("genericUpdateScript")
@handle_graphql_errors("Error executing script")
async def resolve_generic_update_script(_, info, db_name="", schema="public", value="") -> Any:
    """Execute a raw SQL update script."""
    _require_generic_update_script_right(info, value)
    return await resolve_generic_update_script_helper(db_name, schema, value)


@mutation.field("deleteUnusedPartsByBrand")
@handle_graphql_errors("Error deleting unused parts by brand")
async def resolve_delete_unused_parts_by_brand(
    _, _info, db_name: str = "", schema: str = "", value: str = ""
) -> Any:
    """Delete spare parts that have no job usage for a given brand."""
    return await resolve_delete_unused_parts_by_brand_helper(db_name, schema, value)


@mutation.field("importSpareParts")
@handle_graphql_errors("Error importing spare parts")
async def resolve_import_spare_parts(_, _info, db_name="", schema="public", value="") -> Any:
    """Bulk-import spare parts from an uploaded data payload."""
    return await resolve_import_spare_parts_helper(db_name, schema, value)


@mutation.field("mailAdminCredentials")
@handle_graphql_errors("Error mailing admin credentials")
async def resolve_mail_admin_credentials(
    _, info, db_name: str = "", schema: str = "security", value: str = ""
) -> Any:
    """Email login credentials to an admin user."""
    return await resolve_mail_admin_credentials_helper(
        db_name, schema, value, request=info.context.get("request")
    )


@mutation.field("mailBusinessUserCredentials")
@handle_graphql_errors("Error mailing business user credentials")
async def resolve_mail_business_user_credentials(
    _, info, db_name: str = "", schema: str = "security", value: str = ""
) -> Any:
    """Email login credentials to a business user."""
    return await resolve_mail_business_user_credentials_helper(
        db_name, schema, value, request=info.context.get("request")
    )


@mutation.field("setUserBuRole")
@handle_graphql_errors("Error setting user BU/role")
async def resolve_set_user_bu_role(
    _, _info, db_name: str = "", schema: str = "security", value: str = ""
) -> Any:
    """Assign a BU and role to a business user."""
    return await resolve_set_user_bu_role_helper(db_name, schema, value)


@mutation.field("createSingleJob")
@handle_graphql_errors("Error creating single job")
async def resolve_create_single_job(
    _, _info, db_name: str = "", schema: str = "public", value: str = ""
) -> Any:
    """Create a single job record."""
    return await resolve_create_single_job_helper(db_name, schema, value)


@mutation.field("updateJob")
@handle_graphql_errors("Error updating job")
async def resolve_update_job(
    _, _info, db_name: str = "", schema: str = "public", value: str = ""
) -> Any:
    """Update an existing job record."""
    return await resolve_update_job_helper(db_name, schema, value)


@mutation.field("updateOpeningJob")
@handle_graphql_errors("Error updating opening job")
async def resolve_update_opening_job(
    _, _info, db_name: str = "", schema: str = "public", value: str = ""
) -> Any:
    """Update an Opening Job, recording a job_transaction row when its status changes."""
    return await resolve_update_opening_job_helper(db_name, schema, value)


@mutation.field("createJobBatch")
@handle_graphql_errors("Error creating job batch")
async def resolve_create_job_batch(
    _, _info, db_name: str = "", schema: str = "public", value: str = ""
) -> Any:
    """Create a batch of jobs."""
    return await resolve_create_job_batch_helper(db_name, schema, value)


@mutation.field("updateJobBatch")
@handle_graphql_errors("Error updating job batch")
async def resolve_update_job_batch(
    _, _info, db_name: str = "", schema: str = "public", value: str = ""
) -> Any:
    """Update a job batch record."""
    return await resolve_update_job_batch_helper(db_name, schema, value)


@mutation.field("deleteJobBatch")
@handle_graphql_errors("Error deleting job batch")
async def resolve_delete_job_batch(
    _, _info, db_name: str = "", schema: str = "public", value: str = ""
) -> Any:
    """Delete a job batch record."""
    return await resolve_delete_job_batch_helper(db_name, schema, value)


@mutation.field("deliverJob")
@handle_graphql_errors("Error delivering job")
async def resolve_deliver_job(
    _, info, db_name: str = "", schema: str = "public", value: str = ""
) -> Any:
    """Mark a job as delivered."""
    require_access_right(info, "JOBS_DELIVER_JOB")
    return await resolve_deliver_job_helper(db_name, schema, value)


@mutation.field("undoJobTransaction")
@handle_graphql_errors("Error undoing job transaction")
async def resolve_undo_job_transaction(
    _, _info, db_name: str = "", schema: str = "public", value: str = ""
) -> Any:
    """Undo the last transaction on a job."""
    return await resolve_undo_job_transaction_helper(db_name, schema, value)


@mutation.field("undeliverJob")
@handle_graphql_errors("Error undelivering job")
async def resolve_undeliver_job(
    _, info, db_name: str = "", schema: str = "public", value: str = ""
) -> Any:
    """Undeliver a job and restore its pre-delivery status."""
    require_access_right(info, "JOBS_DELIVER_JOB")
    return await resolve_undeliver_job_helper(db_name, schema, value)


@mutation.field("createSalesInvoice")
@handle_graphql_errors("Error creating sales invoice")
async def resolve_create_sales_invoice(
    _, info, db_name: str = "", schema: str = "public", value: str = ""
) -> Any:
    """Create a sales invoice."""
    require_access_right(info, "INVENTORY_SALES_ENTRY")
    return await resolve_create_sales_invoice_helper(db_name, schema, value)


@mutation.field("createJobInvoice")
@handle_graphql_errors("Error creating job invoice")
async def resolve_create_job_invoice(
    _, info, db_name: str = "", schema: str = "public", value: str = ""
) -> Any:
    """Create an invoice for a job."""
    require_access_right(info, "JOBS_DELIVER_JOB")
    return await resolve_create_job_invoice_helper(db_name, schema, value)


@mutation.field("regenerateJobInvoice")
@handle_graphql_errors("Error regenerating job invoice")
async def resolve_regenerate_job_invoice(
    _, info, db_name: str = "", schema: str = "public", value: str = ""
) -> Any:
    """Regenerate an existing job invoice."""
    require_access_right(info, "JOBS_DELIVER_JOB")
    return await resolve_regenerate_job_invoice_helper(db_name, schema, value)


@mutation.field("createJobPayment")
@handle_graphql_errors("Error creating job payment")
async def resolve_create_job_payment(
    _, info, db_name: str = "", schema: str = "public", value: str = ""
) -> Any:
    """Record a payment against a job."""
    # Called from both the Receipts screen and the Deliver Job payment
    # step, so either right suffices — see plans/plan.md's "Bonus" note.
    require_any_access_right(info, ["JOBS_RECEIPTS", "JOBS_DELIVER_JOB"])
    return await resolve_create_job_payment_helper(db_name, schema, value)


@mutation.field("accountsPosting")
@handle_graphql_errors("Error in accountsPosting")
async def resolve_accounts_posting(
    _, info, db_name: str = "", schema: str = "public", value: str = ""
) -> Any:
    """Post unposted money receipts to trace-plus accounts."""
    require_access_right(info, "JOBS_ACCOUNTS_POSTING")
    return await resolve_accounts_posting_helper(db_name, schema, value)


@mutation.field("sendWhatsappCompletion")
@handle_graphql_errors("Error sending WhatsApp completion message")
async def resolve_send_whatsapp_completion(
    _, _info, db_name: str = "", schema: str = "public", value: str = ""
) -> Any:
    """Send the job-completion WhatsApp message, one per customer. Called from
    both the finalize-job form (single job) and the Customer Connect bulk screen
    (many jobs) — no dedicated access right here since the finalize form itself
    has none; Customer Connect's own right (plan-whatsapp.md §6) gates reaching
    this mutation via that screen's menu entry instead."""
    return await resolve_send_whatsapp_completion_helper(db_name, schema, value)


@mutation.field("sendWhatsappJobIntake")
@handle_graphql_errors("Error sending WhatsApp job intake notice")
async def resolve_send_whatsapp_job_intake(
    _, _info, db_name: str = "", schema: str = "public", value: str = ""
) -> Any:
    """Send the Job Intake Notice WhatsApp message, one per customer, at drop-off
    time. Same `branch_id`/`job_ids` payload shape as sendWhatsappCompletion, and
    the same precedent on access rights: no dedicated guard here — JOBS_CUSTOMER_CONNECT
    already gates the client-side entry points that call this (plans/plan-whatsapp.md,
    Step 5)."""
    return await send_job_creation_notice(db_name, schema, value)


@mutation.field("sendWhatsappJobDelivery")
@handle_graphql_errors("Error sending WhatsApp job delivery message")
async def resolve_send_whatsapp_job_delivery(
    _, _info, db_name: str = "", schema: str = "public", value: str = ""
) -> Any:
    """Send the paperless job-delivery WhatsApp messages (summary + OTP), one
    pair per customer, from the Deliver Job / Batch Warranty Jobs screens.
    Same `branch_id`/`job_ids` payload shape as sendWhatsappJobIntake, and the
    same precedent on access rights: no dedicated guard here — Deliver Job's
    own JOBS_DELIVER_JOB right already gates the screen this is called from."""
    return await send_job_delivery_notice(db_name, schema, value)


@mutation.field("sendWhatsappMoneyReceipt")
@handle_graphql_errors("Error sending WhatsApp money receipt")
async def resolve_send_whatsapp_money_receipt(
    _, _info, db_name: str = "", schema: str = "public", value: str = ""
) -> Any:
    """Send the "Download Money Receipt" WhatsApp message for one job_payment
    row, from the Receipts grid. `branch_id`/`payment_id` payload shape (not
    `job_ids` — a receipt send is never grouped/chunked). Same precedent on
    access rights: no dedicated guard here — the Receipts screen's own right
    already gates the entry point that calls this."""
    return await send_whatsapp_money_receipt(db_name, schema, value)


@mutation.field("sendWhatsappJobInvoice")
@handle_graphql_errors("Error sending WhatsApp invoice")
async def resolve_send_whatsapp_job_invoice(
    _, _info, db_name: str = "", schema: str = "public", value: str = ""
) -> Any:
    """Send the "Download Invoice" WhatsApp message for one job, from the
    Delivered Jobs grid — a resend path for jobs that already left the live
    paperless-delivery session (plans/plan.md). `branch_id`/`job_id`
    payload shape (not `job_ids` — an invoice send is never grouped/
    chunked, same precedent as sendWhatsappMoneyReceipt). Same precedent on
    access rights: no dedicated guard here — the Delivered Jobs screen's own
    right already gates the entry point that calls this."""
    return await send_whatsapp_job_invoice(db_name, schema, value)


@mutation.field("verifyJobDeliveryOtp")
@handle_graphql_errors("Error verifying job delivery OTP")
async def resolve_verify_job_delivery_otp(
    _, info, db_name: str = "", schema: str = "public", value: str = ""
) -> Any:
    """Staff-facing confirmation that the customer read the OTP aloud
    (plans/plan.md, Step 3) — authenticated, not a public route. `staff_id`
    comes from the authenticated session's own context, never a
    client-supplied field, same precedent as setJobDeliveryManualConfirmation."""
    staff_id = (info.context or {}).get("user_id")
    return await verify_job_delivery_otp(db_name, schema, value, staff_id)


@mutation.field("setJobDeliveryManualConfirmation")
@handle_graphql_errors("Error recording manual delivery confirmation")
async def resolve_set_job_delivery_manual_confirmation(
    _, info, db_name: str = "", schema: str = "public", value: str = ""
) -> Any:
    """Staff-facing "customer confirmed in person / no WhatsApp" override for
    paperless job delivery (plans/plan.md, Step 1) — always available, since
    some customers have no WhatsApp at all or the OTP never arrives. No
    dedicated access-right guard here, same precedent as the other WhatsApp
    mutations above: Deliver Job's own JOBS_DELIVER_JOB right already gates the
    screen this is called from. `staff_id` comes from the authenticated
    session's own context, never a client-supplied field."""
    staff_id = (info.context or {}).get("user_id")
    return await set_job_delivery_manual_confirmation(db_name, schema, value, staff_id)
