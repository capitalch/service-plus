"""A genericUpdate delete blocked by a row that still points at it becomes a readable
ValidationException (shared/generic_update._in_use_error). No DB: the Postgres error is faked."""
from types import SimpleNamespace

from app.graphql.resolvers.shared.generic_update import _in_use_error


def _fk(primary: str, table: str):
    return SimpleNamespace(diag=SimpleNamespace(constraint_name=f"{table}_x_fkey", message_primary=primary, table_name=table))


def test_delete_of_a_user_with_a_sign_up_request():
    err = _in_use_error(_fk('update or delete on table "user" violates foreign key constraint', "sales_enquiry"))
    assert err.message == "This can't be deleted because it is still used by its sign-up request."
    assert err.extensions["reason"] == "record_in_use"


def test_unknown_referencing_table_is_named_plainly():
    err = _in_use_error(_fk('update or delete on table "brand" violates foreign key constraint', "job_transaction"))
    assert err.message == "This can't be deleted because it is still used by job transaction records."


def test_insert_naming_a_missing_row_is_left_alone():
    assert _in_use_error(_fk('insert or update on table "job" violates foreign key constraint', "job")) is None
