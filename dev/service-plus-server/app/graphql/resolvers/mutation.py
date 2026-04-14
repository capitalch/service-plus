"""
GraphQL Mutation resolvers.
"""

from typing import Any
from ariadne import MutationType
from app.logger import logger
from app.exceptions import ValidationException, GraphQLException, AppMessages
from app.graphql.resolvers.mutation_helper import (
    resolve_create_admin_user_helper,
    resolve_create_bu_schema_and_feed_seed_data_helper,
    resolve_create_business_user_helper,
    resolve_create_client_helper,
    resolve_create_sales_invoice_helper,
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
)
# from app.graphql.pubsub import pubsub


# Create MutationType instance
mutation = MutationType()


@mutation.field("createAdminUser")
async def resolve_create_admin_user(_, info, db_name: str = "", schema: str = "security", value: str = "") -> Any:
    try:
        return await resolve_create_admin_user_helper(db_name, schema, value)
    except ValidationException:
        raise
    except Exception as e:
        logger.error("Error creating admin user: %s", e)
        raise GraphQLException(
            message=AppMessages.OPERATION_FAILED, extensions={"details": str(e)}
        )


@mutation.field("createBuSchemaAndFeedSeedData")
async def resolve_create_bu_schema_and_feed_seed_data(
    _, info, db_name: str = "", schema: str = "security", value: str = ""
) -> Any:
    try:
        return await resolve_create_bu_schema_and_feed_seed_data_helper(db_name, schema, value)
    except ValidationException:
        raise
    except Exception as e:
        logger.error("Error creating BU schema: %s", e, exc_info=True)
        raise GraphQLException(
            message=AppMessages.BU_SCHEMA_CREATE_FAILED, extensions={"details": str(e)}
        )


@mutation.field("createClient")
async def resolve_create_client(_, info, db_name: str = "", schema: str = "public", value: str = "") -> Any:
    try:
        return await resolve_create_client_helper(db_name, schema, value)
    except ValidationException:
        raise
    except Exception as e:
        logger.error("Error creating client: %s", e)
        raise GraphQLException(
            message=AppMessages.OPERATION_FAILED, extensions={"details": str(e)}
        )


@mutation.field("createBusinessUser")
async def resolve_create_business_user(_, info, db_name: str = "", schema: str = "security", value: str = "") -> Any:
    try:
        return await resolve_create_business_user_helper(db_name, schema, value)
    except ValidationException:
        raise
    except Exception as e:
        logger.error("Error creating business user: %s", e, exc_info=True)
        raise GraphQLException(
            message=AppMessages.OPERATION_FAILED, extensions={"details": str(e)}
        )


@mutation.field("createServiceDb")
async def resolve_create_service_db(_, info, db_name: str = "", schema: str = "security", value: str = "") -> Any:
    try:
        return await resolve_create_service_db_helper(db_name, schema, value)
    except ValidationException:
        raise
    except Exception as e:
        logger.error("Error creating service database: %s", e)
        raise GraphQLException(
            message=AppMessages.OPERATION_FAILED, extensions={"details": str(e)}
        )


@mutation.field("feedBuSeedData")
async def resolve_feed_bu_seed_data(
    _, info, db_name: str = "", schema: str = "security", value: str = ""
) -> Any:
    try:
        return await resolve_feed_bu_seed_data_helper(db_name, schema, value)
    except ValidationException:
        raise
    except Exception as e:
        logger.error("Error feeding BU seed data: %s", e, exc_info=True)
        raise GraphQLException(
            message=AppMessages.BU_SEED_FEED_FAILED, extensions={"details": str(e)}
        )


@mutation.field("deleteBuSchema")
async def resolve_delete_bu_schema(
    _, info, db_name: str = "", schema: str = "security", value: str = ""
) -> Any:
    try:
        return await resolve_delete_bu_schema_helper(db_name, schema, value)
    except ValidationException:
        raise
    except Exception as e:
        logger.error("Error dropping BU schema: %s", e, exc_info=True)
        raise GraphQLException(
            message=AppMessages.BU_SCHEMA_DROP_FAILED, extensions={"details": str(e)}
        )


@mutation.field("deleteClient")
async def resolve_delete_client(_, info, db_name: str = "", schema: str = "security", value: str = "") -> Any:
    try:
        return await resolve_delete_client_helper(db_name, schema, value)
    except ValidationException:
        raise
    except Exception as e:
        logger.error("Error deleting client: %s", e)
        raise GraphQLException(
            message=AppMessages.OPERATION_FAILED, extensions={"details": str(e)}
        )


@mutation.field("dropDatabase")
async def resolve_drop_database(_, info, db_name: str = "", schema: str = "security", value: str = "") -> Any:
    try:
        return await resolve_drop_database_helper(db_name, schema, value)
    except ValidationException:
        raise
    except Exception as e:
        logger.error("Error dropping database: %s", e)
        raise GraphQLException(
            message=AppMessages.DB_DROP_FAILED, extensions={"details": str(e)}
        )


@mutation.field("genericUpdate")
async def resolve_generic_update(_, info, db_name="", schema="public", value="") -> Any:
    try:
        return await resolve_generic_update_helper(db_name, schema, value)
    except ValidationException:
        raise
    except Exception as e:
        logger.error("Error in genericUpdate: %s", e)
        raise GraphQLException(
            message=AppMessages.OPERATION_FAILED, extensions={"details": str(e)}
        )


@mutation.field("genericUpdateScript")
async def resolve_generic_update_script(_, info, db_name="", schema="public", value="") -> Any:
    try:
        return await resolve_generic_update_script_helper(db_name, schema, value)
    except ValidationException:
        raise
    except Exception as e:
        logger.error("Error executing script: %s", e)
        raise GraphQLException(
            message=AppMessages.OPERATION_FAILED, extensions={"details": str(e)}
        )


@mutation.field("deleteUnusedPartsByBrand")
async def resolve_delete_unused_parts_by_brand(_, info, db_name: str = "", schema: str = "", value: str = "") -> Any:
    try:
        return await resolve_delete_unused_parts_by_brand_helper(db_name, schema, value)
    except ValidationException:
        raise
    except Exception as e:
        logger.error("Error deleting unused parts by brand: %s", e)
        raise GraphQLException(
            message=AppMessages.OPERATION_FAILED, extensions={"details": str(e)}
        )


@mutation.field("importSpareParts")
async def resolve_import_spare_parts(_, info, db_name="", schema="public", value="") -> Any:
    try:
        return await resolve_import_spare_parts_helper(db_name, schema, value)
    except ValidationException:
        raise
    except Exception as e:
        logger.error("Error importing spare parts: %s", e)
        raise GraphQLException(
            message=AppMessages.OPERATION_FAILED, extensions={"details": str(e)}
        )


@mutation.field("mailAdminCredentials")
async def resolve_mail_admin_credentials(_, info, db_name: str = "", schema: str = "security", value: str = "") -> Any:
    try:
        return await resolve_mail_admin_credentials_helper(db_name, schema, value)
    except ValidationException:
        raise
    except Exception as e:
        logger.error("Error mailing admin credentials: %s", e)
        raise GraphQLException(
            message=AppMessages.OPERATION_FAILED, extensions={"details": str(e)}
        )


@mutation.field("mailBusinessUserCredentials")
async def resolve_mail_business_user_credentials(_, info, db_name: str = "", schema: str = "security", value: str = "") -> Any:
    try:
        return await resolve_mail_business_user_credentials_helper(db_name, schema, value)
    except ValidationException:
        raise
    except Exception as e:
        logger.error("Error mailing business user credentials: %s", e)
        raise GraphQLException(
            message=AppMessages.OPERATION_FAILED, extensions={"details": str(e)}
        )


@mutation.field("setUserBuRole")
async def resolve_set_user_bu_role(_, info, db_name: str = "", schema: str = "security", value: str = "") -> Any:
    try:
        return await resolve_set_user_bu_role_helper(db_name, schema, value)
    except ValidationException:
        raise
    except Exception as e:
        logger.error("Error setting user BU/role: %s", e, exc_info=True)
        raise GraphQLException(
            message=AppMessages.OPERATION_FAILED, extensions={"details": str(e)}
        )


@mutation.field("createSalesInvoice")
async def resolve_create_sales_invoice(_, info, db_name: str = "", schema: str = "public", value: str = "") -> Any:
    try:
        return await resolve_create_sales_invoice_helper(db_name, schema, value)
    except ValidationException:
        raise
    except Exception as e:
        logger.error("Error creating sales invoice: %s", e, exc_info=True)
        raise GraphQLException(
            message=AppMessages.OPERATION_FAILED, extensions={"details": str(e)}
        )
