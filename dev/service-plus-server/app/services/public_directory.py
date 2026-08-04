"""
Cross-tenant company directory for the public website API.

"Company" (per plans/plan.md §2 / plan-nextjs.md §2) is a business unit,
aggregated across every active client's tenant DB. Building this list means
fanning out to every active client's service DB and reading `security.bu` —
slow and slow-changing, so the result is cached in-process with a short TTL.

The opaque company id returned to the browser is a one-way hash of
(db_name, bu_code), never the raw names — resolving it back requires a hit in
this process's cache, so a client can never forge a token pointing at an
arbitrary tenant DB/schema it wasn't handed by /companies.
"""
import hashlib
import time
from dataclasses import dataclass

from app.db.connection.psycopg_driver import exec_sql_query
from app.db.sql.sql_public import PublicSql
from app.logger import logger

_CACHE_TTL_SECONDS: float = 300.0  # 5 minutes


@dataclass(frozen=True)
class Company:
    id: str
    label: str


@dataclass(frozen=True)
class _CompanyEntry:
    db_name: str
    bu_code: str
    label: str


def _company_token(db_name: str, bu_code: str) -> str:
    return hashlib.sha256(f"{db_name}:{bu_code}".encode()).hexdigest()[:20]


class PublicDirectory:
    """In-process cache of the public company directory, refreshed on a TTL."""

    def __init__(self) -> None:
        self._companies: dict[str, _CompanyEntry] = {}
        self._expires_at: float = 0.0

    async def list_companies(self) -> list[Company]:
        await self._refresh_if_stale()
        return [Company(id=token, label=entry.label) for token, entry in self._companies.items()]

    async def resolve_company(self, token: str) -> tuple[str, str] | None:
        """Return (db_name, bu_code) for a company token, or None if unknown/expired."""
        await self._refresh_if_stale()
        entry = self._companies.get(token)
        return (entry.db_name, entry.bu_code) if entry else None

    async def _refresh_if_stale(self) -> None:
        if self._companies and time.monotonic() < self._expires_at:
            return
        await self._refresh()

    async def _refresh(self) -> None:
        companies: dict[str, _CompanyEntry] = {}
        clients = await exec_sql_query(
            db_name=None, schema="public", sql=PublicSql.GET_ACTIVE_CLIENT_DBS
        )

        for client in clients:
            db_name = client["db_name"]
            client_name = client["name"]
            try:
                bus = await exec_sql_query(
                    db_name=db_name, schema="security", sql=PublicSql.LIST_ACTIVE_BUS
                )
            except Exception as exc:  # pylint: disable=broad-except
                # One unreachable/misconfigured tenant DB must not break the whole directory.
                logger.warning(
                    "Skipping tenant db %r while building public directory: %s", db_name, exc
                )
                continue

            multi_bu = len(bus) > 1
            for bu in bus:
                bu_code = bu["code"]
                label = f"{client_name} — {bu['name']}" if multi_bu else client_name
                token = _company_token(db_name, bu_code)
                companies[token] = _CompanyEntry(db_name=db_name, bu_code=bu_code, label=label)

        self._companies = companies
        self._expires_at = time.monotonic() + _CACHE_TTL_SECONDS
        logger.info("Public directory refreshed: %d compan(y/ies)", len(companies))


public_directory = PublicDirectory()
