"""
GraphQL Mutation resolvers.
"""

from typing import Any
from ariadne import MutationType  # pylint: disable=import-error
from app.logger import logger
from app.exceptions import ValidationException, GraphQLException, AppMessages
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
async def resolve_generic_update(_, _info, db_name="", schema="public", value="") -> Any:
    """Execute a generic table upsert/delete operation."""
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
async def resolve_generic_update_script(_, _info, db_name="", schema="public", value="") -> Any:
    """Execute a raw SQL update script."""
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
    _, _info, db_name: str = "", schema: str = "public", value: str = ""
) -> Any:
    """Mark a job as delivered."""
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
    _, _info, db_name: str = "", schema: str = "public", value: str = ""
) -> Any:
    """Undeliver a job and restore its pre-delivery status."""
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
    _, _info, db_name: str = "", schema: str = "public", value: str = ""
) -> Any:
    """Create a sales invoice."""
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
    _, _info, db_name: str = "", schema: str = "public", value: str = ""
) -> Any:
    """Create an invoice for a job."""
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
    _, _info, db_name: str = "", schema: str = "public", value: str = ""
) -> Any:
    """Regenerate an existing job invoice."""
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
    _, _info, db_name: str = "", schema: str = "public", value: str = ""
) -> Any:
    """Record a payment against a job."""
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
    _, _info, db_name: str = "", schema: str = "public", value: str = ""
) -> Any:
    """Post unposted money receipts to trace-plus accounts."""
    try:
        return await resolve_accounts_posting_helper(db_name, schema, value)
    except ValidationException:
        raise
    except Exception as e:
        logger.error("Error in accountsPosting: %s", e, exc_info=True)
        raise GraphQLException(
            message=AppMessages.OPERATION_FAILED, extensions={"details": str(e)}
        ) from e
