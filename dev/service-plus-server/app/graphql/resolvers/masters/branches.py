"""Branches and their default division (plans/plan2.md Step 2).

Every branch has exactly one default division (`division.is_default`). To keep that
true without database triggers:

- `addBranch` is the only way to create a branch: one transaction inserts the branch
  and its Main division (code MAIN, copied from the branch, is_default true).
- `genericUpdate` refuses any `branch` insert, nested ones included
  (`refuse_branch_insert`), and any change that would delete, deactivate, move or
  re-flag a default division (`refuse_default_division_change`).

addBranch also enforces the branch limit (plans/plan.md Step 12): it locks the BU's security.bu
row and counts branches before inserting, in the same transaction.
"""

from typing import Any, Iterator

import psycopg.sql as pgsql
from psycopg.rows import dict_row

from app.core.exceptions import AppMessages, CodedValidationException, ValidationException
from app.db.connection.psycopg_driver import exec_sql, get_service_db_connection, process_data
from app.db.sql.sql_billing import BillingServerSql
from app.db.sql.sql_divisions import DivisionServerSql
from app.graphql.resolvers.shared.generic_query import _decode_value
from app.logger import logger

# The columns the Add Branch dialog sends; anything else in the payload is ignored.
BRANCH_FIELDS: tuple[str, ...] = (
    "address_line1",
    "address_line2",
    "city",
    "code",
    "email",
    "gstin",
    "name",
    "phone",
    "pincode",
    "state_id",
)
REQUIRED_BRANCH_FIELDS: tuple[str, ...] = ("address_line1", "code", "name", "pincode", "state_id")


def _is_insert(row: dict) -> bool:
    """Mirror of psycopg_driver.get_sql: a row inserts unless it carries an id without isIdInsert."""
    return not row.get("id") or bool(row.get("isIdInsert"))


def iter_sql_object_rows(sql_object: Any) -> Iterator[tuple[str | None, list, list[dict]]]:
    """Walk a genericUpdate payload and yield (tableName, deletedIds, rows) for the top
    node and every nested xDetails node, dicts and lists alike."""
    if isinstance(sql_object, list):
        for node in sql_object:
            yield from iter_sql_object_rows(node)
        return
    if not isinstance(sql_object, dict):
        return
    x_data = sql_object.get("xData")
    # An empty xData ({} beside deletedIds) writes nothing in process_details, so skip it.
    rows = [r for r in (x_data if isinstance(x_data, list) else [x_data]) if isinstance(r, dict) and r]
    yield sql_object.get("tableName"), list(sql_object.get("deletedIds") or []), rows
    for row in rows:
        if "xDetails" in row:
            yield from iter_sql_object_rows(row["xDetails"])


def refuse_branch_insert(sql_object: Any) -> None:
    """Refuse a genericUpdate payload that would insert a branch anywhere in it."""
    for table_name, _, rows in iter_sql_object_rows(sql_object):
        if table_name == "branch" and any(_is_insert(r) for r in rows):
            raise CodedValidationException(
                message=AppMessages.BRANCH_INSERT_VIA_ADD_BRANCH, code="BRANCH_INSERT_VIA_ADD_BRANCH"
            )


def division_ids_to_check(sql_object: Any) -> list[int]:
    """Division ids a payload deletes, deactivates or moves to another branch; raises
    at once if any division row sets is_default, which only the server may write."""
    ids: list[int] = []
    for table_name, deleted_ids, rows in iter_sql_object_rows(sql_object):
        if table_name != "division":
            continue
        ids.extend(int(i) for i in deleted_ids)
        for row in rows:
            if "is_default" in row:
                raise CodedValidationException(
                    message=AppMessages.DEFAULT_DIVISION_LOCKED, code="DEFAULT_DIVISION_LOCKED"
                )
            if _is_insert(row):
                continue
            if row.get("is_active") is False or "branch_id" in row:
                ids.append(int(row["id"]))
    return ids


async def refuse_default_division_change(db_name: str, schema: str, sql_object: Any) -> None:
    """Refuse a genericUpdate payload that would delete, deactivate or move a default division."""
    ids = division_ids_to_check(sql_object)
    if not ids:
        return
    rows = await exec_sql(
        db_name=db_name,
        schema=schema,
        sql=DivisionServerSql.GET_DEFAULT_DIVISION_IDS,
        sql_args={"ids": ids},
    )
    if rows:
        raise CodedValidationException(
            message=AppMessages.DEFAULT_DIVISION_LOCKED,
            code="DEFAULT_DIVISION_LOCKED",
            extensions={"ids": [r["id"] for r in rows]},
        )


async def resolve_add_branch_helper(db_name: str, schema: str, value: str) -> dict:
    """Insert a branch and its default Main division in one transaction."""
    payload = _decode_value(value, "addBranch")
    branch = {k: payload[k] for k in BRANCH_FIELDS if k in payload}
    for field in REQUIRED_BRANCH_FIELDS:
        if branch.get(field) in (None, ""):
            raise ValidationException(
                message=AppMessages.REQUIRED_FIELD_MISSING,
                extensions={"field": field},
            )

    async with get_service_db_connection(db_name) as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(pgsql.SQL("SET search_path TO {}").format(pgsql.Identifier(schema)))
            # Branch limit (plans/plan.md Step 12): lock this BU's security.bu row, so a second
            # addBranch or a changeBuPlan on the same BU waits here, then count. No trigger.
            await cur.execute(BillingServerSql.LOCK_BU_FOR_BRANCH, {"schema": schema})
            bu = await cur.fetchone()
            if bu and bu["branch_limit"] is not None:
                await cur.execute(BillingServerSql.COUNT_BRANCHES)
                if (await cur.fetchone())["branch_count"] >= bu["branch_limit"]:
                    raise CodedValidationException(
                        message=AppMessages.BRANCH_LIMIT_REACHED,
                        code="BRANCH_LIMIT_REACHED",
                        extensions={"branchLimit": bu["branch_limit"]},
                    )
            branch_id = await process_data(branch, cur, "branch", None, None)
            await cur.execute(DivisionServerSql.LOCK_DIVISION_TABLE)
            await cur.execute(DivisionServerSql.INSERT_MAIN_DIVISION_FOR_BRANCH, {"branch_id": branch_id})
            division_id = (await cur.fetchone())["id"]

    logger.info("Branch %s created in %s.%s with Main division %s", branch_id, db_name, schema, division_id)
    return {"branchId": branch_id, "divisionId": division_id}
