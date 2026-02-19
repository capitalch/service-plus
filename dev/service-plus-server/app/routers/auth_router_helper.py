from app.db.database import exec_sql
from app.db.sql_auth import SqlAuth
from app.schemas.auth_schema import ClientResponse


async def get_clients_helper(criteria: str = "") -> list[ClientResponse]:
    """Retrieve clients from the database, optionally filtered by name prefix."""
    rows = await exec_sql(
        db_name=None,
        sql=SqlAuth.GET_ALL_CLIENTS_ON_CRITERIA,
        sql_args={"criteria": criteria},
    )
    return [ClientResponse(**row) for row in rows]
