"""Initializing a client database runs every security-schema script that is not in the
generated template DDL (SECURITY_SCHEMA_DDL): the billing columns everywhere, and the sign-up
table in the default customer database. No DB: the helper's source is checked."""
import inspect

from app.graphql.resolvers.bu_admin import provisioning


def test_new_database_gets_billing_ddl():
    assert "BillingServerSql.BU_BILLING_DDL" in inspect.getsource(provisioning.resolve_create_service_db_helper)


def test_default_customer_database_gets_the_sign_up_table():
    source = inspect.getsource(provisioning.resolve_create_service_db_helper)
    assert "settings.default_customer_db_name" in source
    assert "SignupServerSql.SALES_ENQUIRY_DDL" in source


def test_deleting_a_sign_up_users_clears_the_link():
    """Deleting the Manager an approved sign-up created must not be blocked by the request."""
    from app.db.sql.sql_signups import SignupServerSql

    assert 'REFERENCES security."user" (id) ON DELETE SET NULL' in SignupServerSql.SALES_ENQUIRY_DDL
