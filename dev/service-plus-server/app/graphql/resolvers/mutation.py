"""
GraphQL Mutation resolvers.
"""

import json
from typing import Any
from urllib.parse import unquote
from ariadne import MutationType  # pylint: disable=import-error
from app.logger import logger
from app.exceptions import ValidationException, GraphQLException, AppMessages
from app.graphql.resolvers.auth_guards import require_access_right, require_any_access_right
from app.graphql.resolvers.mutation_helper import (
    resolve_create_admin_user_helper,
    resolve_create_bu_schema_and_feed_seed_data_helper,
    resolve_create_business_user_helper,
    resolve_create_client_helper,
    resolve_create_single_job_helper,
    resolve_create_sales_invoice_helper,
    resolve_create_job_invoice_helper,
    resolve_regenerate_job_invoice_helper,
    resolve_create_job_payment_helper,
    resolve_update_job_helper,
    resolve_create_service_db_helper,
    resolve_delete_bu_schema_helper,
    resolve_delete_client_helper,
    resolve_delete_unused_parts_by_brand_helper,
    resolve_drop_database_helper,
    resolve_feed_bu_seed_data_helper,
    resolve_seed_security_data_helper,
    resolve_generic_update_helper,
    resolve_generic_update_script_helper,
    resolve_mail_admin_credentials_helper,
    resolve_import_spare_parts_helper,
    resolve_mail_business_user_credentials_helper,
    resolve_set_user_bu_role_helper,
    resolve_create_job_batch_helper,
    resolve_update_job_batch_helper,
    resolve_delete_job_batch_helper,
    resolve_deliver_job_helper,
    resolve_undo_job_transaction_helper,
    resolve_undeliver_job_helper,
    resolve_accounts_posting_helper,
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
GENERIC_UPDATE_TABLE_RIGHTS: dict[str, str] = {
    # Masters
    "brand": "MASTERS_MENU",
    "customer_type": "MASTERS_MENU",
    "document_type": "MASTERS_MENU",
    "job_type": "MASTERS_MENU",
    "job_receive_manner": "MASTERS_MENU",
    "job_delivery_manner": "MASTERS_MENU",
    "job_status": "MASTERS_MENU",
    "job_receive_condition": "MASTERS_MENU",
    "product_brand_model": "MASTERS_MENU",
    "spare_part_master": "MASTERS_MENU",
    "customer_contact": "MASTERS_MENU",
    "supplier": "MASTERS_MENU",
    "technician": "MASTERS_MENU",
    "branch": "MASTERS_MENU",
    "state": "MASTERS_MENU",
    "financial_year": "MASTERS_MENU",
    "additional_charge": "MASTERS_MENU",
    # Configurations
    "division": "CONFIG_MENU",
    "app_setting": "CONFIG_MENU",
    "document_sequence": "CONFIG_MENU",
    # Deliver Job
    "job_invoice": "JOBS_DELIVER_JOB",
    # Inventory
    "purchase_invoice": "INVENTORY_PURCHASE_ENTRY",
    "sales_invoice": "INVENTORY_SALES_ENTRY",
    "stock_adjustment": "INVENTORY_STOCK_ADJUSTMENT",
    "stock_branch_transfer": "INVENTORY_BRANCH_TRANSFER",
    "stock_opening_balance": "INVENTORY_OPENING_STOCK",
}

# genericUpdateScript executes a named SqlStore query by sql_id (not a
# tableName), so it needs its own, separately-keyed rights dict. Only
# Set Part Location needs one today — see plans/plan.md Step 8.
GENERIC_UPDATE_SCRIPT_SQL_ID_RIGHTS: dict[str, str] = {
    "SET_PART_LOCATIONS": "INVENTORY_SET_PART_LOCATION",
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
async def resolve_create_admin_user(
    _, _info, db_name: str = "", schema: str = "security", value: str = ""
) -> Any:
    """Create an admin user and email a password-reset link."""
    try:
        return await resolve_create_admin_user_helper(db_name, schema, value)
    except ValidationException:
        raise
    except Exception as e:
        logger.error("Error creating admin user: %s", e)
        raise GraphQLException(
            message=AppMessages.OPERATION_FAILED, extensions={"details": str(e)}
        ) from e


@mutation.field("createBuSchemaAndFeedSeedData")
async def resolve_create_bu_schema_and_feed_seed_data(
    _, _info, db_name: str = "", schema: str = "security", value: str = ""
) -> Any:
    """Create a BU schema and seed its lookup tables."""
    try:
        return await resolve_create_bu_schema_and_feed_seed_data_helper(db_name, schema, value)
    except ValidationException:
        raise
    except Exception as e:
        logger.error("Error creating BU schema: %s", e, exc_info=True)
        raise GraphQLException(
            message=AppMessages.BU_SCHEMA_CREATE_FAILED, extensions={"details": str(e)}
        ) from e


@mutation.field("createClient")
async def resolve_create_client(
    _, _info, db_name: str = "", schema: str = "public", value: str = ""
) -> Any:
    """Insert a new client record."""
    try:
        return await resolve_create_client_helper(db_name, schema, value)
    except ValidationException:
        raise
    except Exception as e:
        logger.error("Error creating client: %s", e)
        raise GraphQLException(
            message=AppMessages.OPERATION_FAILED, extensions={"details": str(e)}
        ) from e


@mutation.field("createBusinessUser")
async def resolve_create_business_user(
    _, _info, db_name: str = "", schema: str = "security", value: str = ""
) -> Any:
    """Create a business user in the security schema."""
    try:
        return await resolve_create_business_user_helper(db_name, schema, value)
    except ValidationException:
        raise
    except Exception as e:
        logger.error("Error creating business user: %s", e, exc_info=True)
        raise GraphQLException(
            message=AppMessages.OPERATION_FAILED, extensions={"details": str(e)}
        ) from e


@mutation.field("createServiceDb")
async def resolve_create_service_db(
    _, _info, db_name: str = "", schema: str = "security", value: str = ""
) -> Any:
    """Create a new PostgreSQL service database for a client."""
    try:
        return await resolve_create_service_db_helper(db_name, schema, value)
    except ValidationException:
        raise
    except Exception as e:
        logger.error("Error creating service database: %s", e)
        raise GraphQLException(
            message=AppMessages.OPERATION_FAILED, extensions={"details": str(e)}
        ) from e


@mutation.field("feedBuSeedData")
async def resolve_feed_bu_seed_data(
    _, _info, db_name: str = "", schema: str = "security", value: str = ""
) -> Any:
    """Feed seed data into an existing BU schema."""
    try:
        return await resolve_feed_bu_seed_data_helper(db_name, schema, value)
    except ValidationException:
        raise
    except Exception as e:
        logger.error("Error feeding BU seed data: %s", e, exc_info=True)
        raise GraphQLException(
            message=AppMessages.BU_SEED_FEED_FAILED, extensions={"details": str(e)}
        ) from e


@mutation.field("seedSecurityData")
async def resolve_seed_security_data(
    _, _info, db_name: str = "", schema: str = "security", value: str = ""
) -> Any:
    """Feed seed data into an existing client's security schema."""
    try:
        return await resolve_seed_security_data_helper(db_name, schema, value)
    except ValidationException:
        raise
    except Exception as e:
        logger.error("Error seeding security data: %s", e, exc_info=True)
        raise GraphQLException(
            message=AppMessages.SECURITY_SEED_FEED_FAILED, extensions={"details": str(e)}
        ) from e


@mutation.field("deleteBuSchema")
async def resolve_delete_bu_schema(
    _, _info, db_name: str = "", schema: str = "security", value: str = ""
) -> Any:
    """Drop a BU schema and optionally delete its security.bu row."""
    try:
        return await resolve_delete_bu_schema_helper(db_name, schema, value)
    except ValidationException:
        raise
    except Exception as e:
        logger.error("Error dropping BU schema: %s", e, exc_info=True)
        raise GraphQLException(
            message=AppMessages.BU_SCHEMA_DROP_FAILED, extensions={"details": str(e)}
        ) from e


@mutation.field("deleteClient")
async def resolve_delete_client(
    _, _info, db_name: str = "", schema: str = "security", value: str = ""
) -> Any:
    """Guard inactive state, drop client database, delete client row."""
    try:
        return await resolve_delete_client_helper(db_name, schema, value)
    except ValidationException:
        raise
    except Exception as e:
        logger.error("Error deleting client: %s", e)
        raise GraphQLException(
            message=AppMessages.OPERATION_FAILED, extensions={"details": str(e)}
        ) from e


@mutation.field("dropDatabase")
async def resolve_drop_database(
    _, _info, db_name: str = "", schema: str = "security", value: str = ""
) -> Any:
    """Physically drop an orphan PostgreSQL database."""
    try:
        return await resolve_drop_database_helper(db_name, schema, value)
    except ValidationException:
        raise
    except Exception as e:
        logger.error("Error dropping database: %s", e)
        raise GraphQLException(
            message=AppMessages.DB_DROP_FAILED, extensions={"details": str(e)}
        ) from e


@mutation.field("genericUpdate")
async def resolve_generic_update(_, info, db_name="", schema="public", value="") -> Any:
    """Execute a generic table upsert/delete operation."""
    _require_generic_update_table_right(info, value)
    try:
        return await resolve_generic_update_helper(db_name, schema, value)
    except ValidationException:
        raise
    except Exception as e:
        logger.error("Error in genericUpdate: %s", e)
        raise GraphQLException(
            message=AppMessages.OPERATION_FAILED, extensions={"details": str(e)}
        ) from e


@mutation.field("genericUpdateScript")
async def resolve_generic_update_script(_, info, db_name="", schema="public", value="") -> Any:
    """Execute a raw SQL update script."""
    _require_generic_update_script_right(info, value)
    try:
        return await resolve_generic_update_script_helper(db_name, schema, value)
    except ValidationException:
        raise
    except Exception as e:
        logger.error("Error executing script: %s", e)
        raise GraphQLException(
            message=AppMessages.OPERATION_FAILED, extensions={"details": str(e)}
        ) from e


@mutation.field("deleteUnusedPartsByBrand")
async def resolve_delete_unused_parts_by_brand(
    _, _info, db_name: str = "", schema: str = "", value: str = ""
) -> Any:
    """Delete spare parts that have no job usage for a given brand."""
    try:
        return await resolve_delete_unused_parts_by_brand_helper(db_name, schema, value)
    except ValidationException:
        raise
    except Exception as e:
        logger.error("Error deleting unused parts by brand: %s", e)
        raise GraphQLException(
            message=AppMessages.OPERATION_FAILED, extensions={"details": str(e)}
        ) from e


@mutation.field("importSpareParts")
async def resolve_import_spare_parts(_, _info, db_name="", schema="public", value="") -> Any:
    """Bulk-import spare parts from an uploaded data payload."""
    try:
        return await resolve_import_spare_parts_helper(db_name, schema, value)
    except ValidationException:
        raise
    except Exception as e:
        logger.error("Error importing spare parts: %s", e)
        raise GraphQLException(
            message=AppMessages.OPERATION_FAILED, extensions={"details": str(e)}
        ) from e


@mutation.field("mailAdminCredentials")
async def resolve_mail_admin_credentials(
    _, _info, db_name: str = "", schema: str = "security", value: str = ""
) -> Any:
    """Email login credentials to an admin user."""
    try:
        return await resolve_mail_admin_credentials_helper(db_name, schema, value)
    except ValidationException:
        raise
    except Exception as e:
        logger.error("Error mailing admin credentials: %s", e)
        raise GraphQLException(
            message=AppMessages.OPERATION_FAILED, extensions={"details": str(e)}
        ) from e


@mutation.field("mailBusinessUserCredentials")
async def resolve_mail_business_user_credentials(
    _, _info, db_name: str = "", schema: str = "security", value: str = ""
) -> Any:
    """Email login credentials to a business user."""
    try:
        return await resolve_mail_business_user_credentials_helper(db_name, schema, value)
    except ValidationException:
        raise
    except Exception as e:
        logger.error("Error mailing business user credentials: %s", e)
        raise GraphQLException(
            message=AppMessages.OPERATION_FAILED, extensions={"details": str(e)}
        ) from e


@mutation.field("setUserBuRole")
async def resolve_set_user_bu_role(
    _, _info, db_name: str = "", schema: str = "security", value: str = ""
) -> Any:
    """Assign a BU and role to a business user."""
    try:
        return await resolve_set_user_bu_role_helper(db_name, schema, value)
    except ValidationException:
        raise
    except Exception as e:
        logger.error("Error setting user BU/role: %s", e, exc_info=True)
        raise GraphQLException(
            message=AppMessages.OPERATION_FAILED, extensions={"details": str(e)}
        ) from e


@mutation.field("createSingleJob")
async def resolve_create_single_job(
    _, _info, db_name: str = "", schema: str = "public", value: str = ""
) -> Any:
    """Create a single job record."""
    try:
        return await resolve_create_single_job_helper(db_name, schema, value)
    except ValidationException:
        raise
    except Exception as e:
        logger.error("Error creating single job: %s", e, exc_info=True)
        raise GraphQLException(
            message=AppMessages.OPERATION_FAILED, extensions={"details": str(e)}
        ) from e


@mutation.field("updateJob")
async def resolve_update_job(
    _, _info, db_name: str = "", schema: str = "public", value: str = ""
) -> Any:
    """Update an existing job record."""
    try:
        return await resolve_update_job_helper(db_name, schema, value)
    except ValidationException:
        raise
    except Exception as e:
        logger.error("Error updating job: %s", e, exc_info=True)
        raise GraphQLException(
            message=AppMessages.OPERATION_FAILED, extensions={"details": str(e)}
        ) from e


@mutation.field("createJobBatch")
async def resolve_create_job_batch(
    _, _info, db_name: str = "", schema: str = "public", value: str = ""
) -> Any:
    """Create a batch of jobs."""
    try:
        return await resolve_create_job_batch_helper(db_name, schema, value)
    except Exception as e:
        logger.error("Error creating job batch: %s", e, exc_info=True)
        raise GraphQLException(
            message=AppMessages.OPERATION_FAILED, extensions={"details": str(e)}
        ) from e


@mutation.field("updateJobBatch")
async def resolve_update_job_batch(
    _, _info, db_name: str = "", schema: str = "public", value: str = ""
) -> Any:
    """Update a job batch record."""
    try:
        return await resolve_update_job_batch_helper(db_name, schema, value)
    except Exception as e:
        logger.error("Error updating job batch: %s", e, exc_info=True)
        raise GraphQLException(
            message=AppMessages.OPERATION_FAILED, extensions={"details": str(e)}
        ) from e


@mutation.field("deleteJobBatch")
async def resolve_delete_job_batch(
    _, _info, db_name: str = "", schema: str = "public", value: str = ""
) -> Any:
    """Delete a job batch record."""
    try:
        return await resolve_delete_job_batch_helper(db_name, schema, value)
    except Exception as e:
        logger.error("Error deleting job batch: %s", e, exc_info=True)
        raise GraphQLException(
            message=AppMessages.OPERATION_FAILED, extensions={"details": str(e)}
        ) from e


@mutation.field("deliverJob")
async def resolve_deliver_job(
    _, info, db_name: str = "", schema: str = "public", value: str = ""
) -> Any:
    """Mark a job as delivered."""
    require_access_right(info, "JOBS_DELIVER_JOB")
    try:
        return await resolve_deliver_job_helper(db_name, schema, value)
    except ValidationException:
        raise
    except Exception as e:
        logger.error("Error delivering job: %s", e, exc_info=True)
        raise GraphQLException(
            message=AppMessages.OPERATION_FAILED, extensions={"details": str(e)}
        ) from e


@mutation.field("undoJobTransaction")
async def resolve_undo_job_transaction(
    _, _info, db_name: str = "", schema: str = "public", value: str = ""
) -> Any:
    """Undo the last transaction on a job."""
    try:
        return await resolve_undo_job_transaction_helper(db_name, schema, value)
    except ValidationException:
        raise
    except Exception as e:
        logger.error("Error undoing job transaction: %s", e, exc_info=True)
        raise GraphQLException(
            message=AppMessages.OPERATION_FAILED, extensions={"details": str(e)}
        ) from e


@mutation.field("undeliverJob")
async def resolve_undeliver_job(
    _, info, db_name: str = "", schema: str = "public", value: str = ""
) -> Any:
    """Undeliver a job and restore its pre-delivery status."""
    require_access_right(info, "JOBS_DELIVER_JOB")
    try:
        return await resolve_undeliver_job_helper(db_name, schema, value)
    except ValidationException:
        raise
    except Exception as e:
        logger.error("Error undelivering job: %s", e, exc_info=True)
        raise GraphQLException(
            message=AppMessages.OPERATION_FAILED, extensions={"details": str(e)}
        ) from e


@mutation.field("createSalesInvoice")
async def resolve_create_sales_invoice(
    _, info, db_name: str = "", schema: str = "public", value: str = ""
) -> Any:
    """Create a sales invoice."""
    require_access_right(info, "INVENTORY_SALES_ENTRY")
    try:
        return await resolve_create_sales_invoice_helper(db_name, schema, value)
    except ValidationException:
        raise
    except Exception as e:
        logger.error("Error creating sales invoice: %s", e, exc_info=True)
        raise GraphQLException(
            message=AppMessages.OPERATION_FAILED, extensions={"details": str(e)}
        ) from e


@mutation.field("createJobInvoice")
async def resolve_create_job_invoice(
    _, info, db_name: str = "", schema: str = "public", value: str = ""
) -> Any:
    """Create an invoice for a job."""
    require_access_right(info, "JOBS_DELIVER_JOB")
    try:
        return await resolve_create_job_invoice_helper(db_name, schema, value)
    except ValidationException:
        raise
    except Exception as e:
        logger.error("Error creating job invoice: %s", e, exc_info=True)
        raise GraphQLException(
            message=AppMessages.OPERATION_FAILED, extensions={"details": str(e)}
        ) from e


@mutation.field("regenerateJobInvoice")
async def resolve_regenerate_job_invoice(
    _, info, db_name: str = "", schema: str = "public", value: str = ""
) -> Any:
    """Regenerate an existing job invoice."""
    require_access_right(info, "JOBS_DELIVER_JOB")
    try:
        return await resolve_regenerate_job_invoice_helper(db_name, schema, value)
    except ValidationException:
        raise
    except Exception as e:
        logger.error("Error regenerating job invoice: %s", e, exc_info=True)
        raise GraphQLException(
            message=AppMessages.OPERATION_FAILED, extensions={"details": str(e)}
        ) from e


@mutation.field("createJobPayment")
async def resolve_create_job_payment(
    _, info, db_name: str = "", schema: str = "public", value: str = ""
) -> Any:
    """Record a payment against a job."""
    # Called from both the Receipts screen and the Deliver Job payment
    # step, so either right suffices — see plans/plan.md's "Bonus" note.
    require_any_access_right(info, ["JOBS_RECEIPTS", "JOBS_DELIVER_JOB"])
    try:
        return await resolve_create_job_payment_helper(db_name, schema, value)
    except ValidationException:
        raise
    except Exception as e:
        logger.error("Error creating job payment: %s", e, exc_info=True)
        raise GraphQLException(
            message=AppMessages.OPERATION_FAILED, extensions={"details": str(e)}
        ) from e


@mutation.field("accountsPosting")
async def resolve_accounts_posting(
    _, info, db_name: str = "", schema: str = "public", value: str = ""
) -> Any:
    """Post unposted money receipts to trace-plus accounts."""
    require_access_right(info, "JOBS_ACCOUNTS_POSTING")
    try:
        return await resolve_accounts_posting_helper(db_name, schema, value)
    except ValidationException:
        raise
    except Exception as e:
        logger.error("Error in accountsPosting: %s", e, exc_info=True)
        raise GraphQLException(
            message=AppMessages.OPERATION_FAILED, extensions={"details": str(e)}
        ) from e
