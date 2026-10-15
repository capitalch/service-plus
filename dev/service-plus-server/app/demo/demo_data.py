"""Live-demo data generator (plans/plan.md Step 6).

Builds a believable workshop in the demo business unit (settings.demo_db_name /
settings.demo_bu_code) by calling the same write helpers the app's own mutations call, so
job numbering, stock balances, job history, invoice and receipt numbering stay exactly as
the screens would leave them.

- First fill (the BU has no jobs): business details, masters, opening purchases, then 90
  days of activity ending today.
- Top-up (it has jobs): activity for every day after the newest demo job up to today, at
  most 90 days. Open jobs move on day by day, so old jobs finish instead of piling up.

It takes no database or BU argument, refuses when the demo is not configured, holds a
database advisory lock while it runs and adds nothing when the newest job is already
today's. Super Admin starts it from System settings (demoTopUp); it runs as a background
task and demo_status() reports progress.
"""

import asyncio
import json
import random
from datetime import date, timedelta
from typing import Any
from urllib.parse import quote

from app.config import settings
from app.core.billing import today_ist
from app.db.connection.psycopg_driver import exec_sql, get_service_db_connection
from app.db.sql.sql_demo import DemoServerSql
from app.demo import demo_catalogue as cat
from app.graphql.resolvers.jobs.invoicing import resolve_create_job_invoice_helper
from app.graphql.resolvers.jobs.mutations import (
    resolve_create_job_payment_helper,
    resolve_create_single_job_helper,
    resolve_deliver_job_helper,
    resolve_update_job_helper,
)
from app.graphql.resolvers.sales_accounts.mutations import resolve_create_sales_invoice_helper
from app.graphql.resolvers.shared.generic_update import resolve_generic_update_helper
from app.logger import logger

MAX_DAYS = 90
MARKUP = 1.2
STOCK_TARGET = 6

# In-process status of the current or last run, read by the demoStatus query.
_state: dict[str, Any] = {"lastResult": None, "running": False}


class DemoNotConfiguredError(Exception):
    """The demo settings are empty or the demo business unit does not exist."""


async def demo_status() -> dict[str, Any]:
    """For the Super Admin's Live demo card: which BU is the demo, its size and newest job
    date, whether a run is going on in this server process, and the last run's summary."""
    status: dict[str, Any] = {
        "buCode": settings.demo_bu_code,
        "configured": settings.is_demo_enabled(),
        "dbName": settings.demo_db_name,
        **_state,
    }
    if status["configured"]:
        try:
            rows = await exec_sql(
                db_name=settings.demo_db_name, schema=settings.demo_bu_code, sql=DemoServerSql.GET_DEMO_COUNTS
            )
            row = rows[0]
            status.update(
                customers=row["customers"],
                jobs=row["jobs"],
                newestJobDate=row["newest_job_date"].isoformat() if row["newest_job_date"] else None,
            )
        except Exception as e:  # pylint: disable=broad-except
            logger.warning("Demo status read failed: %s", e)
            status["configured"] = False
    return status


def start_demo_top_up() -> bool:
    """Start a run in the background. False when one is already running here."""
    if _state["running"]:
        return False
    _state["running"] = True
    asyncio.get_running_loop().create_task(_run_and_record())
    return True


async def _run_and_record() -> None:
    try:
        _state["lastResult"] = await run_demo_top_up()
    except Exception as e:  # pylint: disable=broad-except
        logger.exception("Demo data run failed")
        _state["lastResult"] = {"error": str(e) or e.__class__.__name__}
    finally:
        _state["running"] = False


async def run_demo_brand_backfill(brand_codes: list[str], days: int = 30) -> dict[str, Any]:
    """One-off: add catalogue items the demo lacks and `days` days of jobs for these brands
    (e.g. ["CASIO", "SONY"]). Same lock and safety as run_demo_top_up."""
    if not settings.is_demo_enabled():
        raise DemoNotConfiguredError("The live demo is not configured on this server.")
    db_name, schema = settings.demo_db_name, settings.demo_bu_code
    async with get_service_db_connection(db_name, autocommit=True) as lock_conn:
        got = await (await lock_conn.execute("SELECT pg_try_advisory_lock(%s)", (DemoServerSql.LOCK_KEY,))).fetchone()
        if not got[0]:
            return {"message": "Demo data is already being added."}
        try:
            return await _Generator(db_name, schema).backfill_brands(brand_codes, days)
        finally:
            await lock_conn.execute("SELECT pg_advisory_unlock(%s)", (DemoServerSql.LOCK_KEY,))


async def run_demo_top_up() -> dict[str, Any]:
    """First fill or top-up of the demo BU; returns a summary of what was added."""
    if not settings.is_demo_enabled():
        raise DemoNotConfiguredError("The live demo is not configured on this server.")
    db_name, schema = settings.demo_db_name, settings.demo_bu_code
    async with get_service_db_connection(db_name, autocommit=True) as lock_conn:
        got = await (await lock_conn.execute("SELECT pg_try_advisory_lock(%s)", (DemoServerSql.LOCK_KEY,))).fetchone()
        if not got[0]:
            return {"message": "Demo data is already being added."}
        try:
            return await _Generator(db_name, schema).run()
        finally:
            await lock_conn.execute("SELECT pg_advisory_unlock(%s)", (DemoServerSql.LOCK_KEY,))


def _encode(obj: dict) -> str:
    return quote(json.dumps(obj, default=str))


def _money(x: float) -> float:
    return round(x + 0.0, 2)


class _Generator:  # pylint: disable=too-many-instance-attributes,too-few-public-methods
    """One run. Holds the BU's ids so each write is a single helper call."""

    def __init__(self, db_name: str, schema: str):
        self.db, self.schema = db_name, schema
        self.counts = {"customers": 0, "deliveries": 0, "jobs": 0, "purchases": 0, "receipts": 0, "sales": 0}
        self.branch_id = self.division_id = 0
        self.customers: list[int] = []
        self.ids: dict[str, dict[str, int]] = {}
        self.models: list[dict] = []
        self.next_mobile = 9000010001
        self.parts: list[dict] = []
        self.state_id, self.state_gst = 0, ""
        self.suppliers: list[int] = []
        self.technicians: list[int] = []
        self.user_id: int | None = None

    # ── plumbing ─────────────────────────────────────────────────────────────

    async def _q(self, sql: str, args: dict | None = None) -> list[dict]:
        """Read in the demo BU's schema."""
        return await exec_sql(db_name=self.db, schema=self.schema, sql=sql, sql_args=args or {})

    async def _upsert(self, table: str, x_data: dict) -> int:
        return await resolve_generic_update_helper(self.db, self.schema, _encode({"tableName": table, "xData": x_data}))

    # ── run ──────────────────────────────────────────────────────────────────

    async def run(self) -> dict[str, Any]:
        """First fill or top-up up to today; returns the counts added."""
        today = today_ist()
        if not await self._q(DemoServerSql.GET_BRANCH_AND_DIVISION):
            raise DemoNotConfiguredError(f"Business unit {self.schema} has no head-office branch.")
        newest_row = (await self._q(DemoServerSql.GET_NEWEST_JOB_DATE))[0]
        first_fill = not newest_row["jobs"]
        start = today - timedelta(days=MAX_DAYS - 1)
        await self._load_context()
        if first_fill:
            await self._seed_business()
            await self._seed_masters()
            await self._load_context()
            await self._restock(start, force=True)
        else:
            start = max(start, newest_row["newest"] + timedelta(days=1))
            await self._add_new_catalogue_items(min(start, today))
            if start > today:
                return {"message": "The demo already has today's data; nothing added.", **self.counts}

        day = start
        while day <= today:
            await self._simulate_day(day)
            day += timedelta(days=1)
        logger.info("Demo data added for %s.%s from %s to %s: %s", self.db, self.schema, start, today, self.counts)
        return {
            "firstFill": first_fill,
            "fromDate": start.isoformat(),
            "toDate": today.isoformat(),
            **self.counts,
        }

    async def backfill_brands(self, brand_codes: list[str], days: int) -> dict[str, Any]:
        """Extra jobs for the given brands over the last `days` days, with their full life
        (repair, final, delivery, invoice). Other open jobs move on those days too, exactly
        as a normal run would. Job numbers continue from the newest, so these jobs carry
        later numbers than jobs of the same dates."""
        today = today_ist()
        start = today - timedelta(days=min(days, MAX_DAYS) - 1)
        await self._load_context()
        await self._add_new_catalogue_items(start)
        brand_ids = {r["id"] for r in await self._q(DemoServerSql.GET_BRANDS) if r["code"] in brand_codes}
        models = [m for m in self.models if m["brand_id"] in brand_ids]
        if not models:
            raise DemoNotConfiguredError(f"No models for brands {', '.join(brand_codes)} in the demo catalogue.")
        day = start
        while day <= today:
            rng = random.Random(f"backfill-{'-'.join(sorted(brand_codes))}-{day}")
            await self._advance_open_jobs(day)
            for _ in range(rng.randint(1, 3)):
                await self._new_job(day, rng, models)
            day += timedelta(days=1)
        logger.info("Demo backfill for %s from %s to %s: %s", brand_codes, start, today, self.counts)
        return {"fromDate": start.isoformat(), "toDate": today.isoformat(), **self.counts}

    async def _add_new_catalogue_items(self, day: date) -> None:
        """Bring catalogue additions into an existing demo and stock their parts on `day`."""
        new_parts = await self._sync_catalogue()
        if not new_parts:
            return
        await self._load_context()
        fresh = [p for p in self.parts if p["id"] in set(new_parts)]
        by_brand: dict[int, list[dict]] = {}
        for part in fresh:
            by_brand.setdefault(part["brand_id"], []).append({**part, "need": STOCK_TARGET + 2})
        rng = random.Random(f"catalogue-{day}")
        for brand_id, parts in by_brand.items():
            await self._purchase(day, brand_id, parts, rng)

    async def _load_context(self) -> None:
        row = (await self._q(DemoServerSql.GET_BRANCH_AND_DIVISION))[0]
        self.branch_id, self.division_id = row["branch_id"], row["division_id"]
        self.ids = {}
        for r in await self._q(DemoServerSql.GET_LOOKUP_IDS):
            self.ids.setdefault(r["kind"], {})[r["code"]] = r["id"]
        state = (await self._q(DemoServerSql.GET_WEST_BENGAL))[0]
        self.state_id, self.state_gst = state["id"], (state["gst_state_code"] or "").strip()
        self.technicians = [r["id"] for r in await self._q(DemoServerSql.GET_TECHNICIANS)]
        users = await exec_sql(
            db_name=self.db, schema="security", sql=DemoServerSql.GET_DEMO_USER_ID,
            sql_args={"username": settings.demo_username},
        )
        if not users:
            raise DemoNotConfiguredError(f"Demo user {settings.demo_username} not found.")
        self.user_id = users[0]["id"]
        self.suppliers = [r["id"] for r in await self._q(DemoServerSql.GET_SUPPLIERS)]
        self.models = await self._q(DemoServerSql.GET_MODELS)
        self.parts = await self._q(DemoServerSql.GET_PARTS)
        customers = await self._q(DemoServerSql.GET_CUSTOMERS)
        self.customers = [r["id"] for r in customers]
        mobiles = [int(r["mobile"]) for r in customers if (r["mobile"] or "").isdigit()]
        self.next_mobile = max([9000010000, *mobiles]) + 1

    # ── first fill: business and masters ────────────────────────────────────

    async def _seed_business(self) -> None:
        b = cat.BUSINESS
        address = {"address_line1": b["address_line1"], "city": b["city"], "pincode": b["pincode"]}
        await self._upsert("branch", {"id": self.branch_id, "email": b["email"], "phone": b["phone"], **address})
        await self._upsert(
            "division",
            {"id": self.division_id, "email": b["email"], "name": b["name"], "phone": b["phone"], **address},
        )
        # Counter sales and service invoices share the "SI" prefix in a fresh BU; give sales their own.
        await self._upsert("document_sequence", {"id": self.ids["doc_seq"]["SALES_INVOICE"], "prefix": "CS"})

    async def _seed_masters(self) -> None:
        """First fill only: technicians, suppliers, the catalogue and 80 customers."""
        rng = random.Random("masters")
        for code, name, spec in cat.TECHNICIANS:
            await self._upsert(
                "technician", {"branch_id": self.branch_id, "code": code, "name": name, "specialization": spec}
            )
        for name, phone in cat.SUPPLIERS:
            await self._upsert(
                "supplier",
                {"city": "Kolkata", "email": "accounts@example.com", "name": name, "phone": phone, "state_id": self.state_id},
            )
        await self._sync_catalogue()
        for _ in range(80):
            await self._new_customer(rng)

    async def _sync_catalogue(self) -> list[int]:  # pylint: disable=too-many-locals
        """Add every product, brand, model and part of demo_catalogue that the BU lacks, so a
        catalogue addition reaches an existing demo on its next run. Returns the new part ids."""
        product_ids = {r["name"]: r["id"] for r in await self._q(DemoServerSql.GET_PRODUCTS)}
        brand_ids = {r["code"]: r["id"] for r in await self._q(DemoServerSql.GET_BRANDS)}
        models = {(r["brand_id"], r["product_id"], r["model_name"]) for r in await self._q(DemoServerSql.GET_MODELS)}
        parts = {(r["brand_id"], r["category"], r["part_name"]) for r in await self._q(DemoServerSql.GET_PARTS)}
        new_parts: list[int] = []
        for product in cat.PRODUCTS:
            if product not in product_ids:
                product_ids[product] = await self._upsert("product", {"name": product})
        for code, name, brand_models in cat.BRANDS:
            if code not in brand_ids:
                brand_ids[code] = await self._upsert("brand", {"code": code, "name": name})
            brand_id = brand_ids[code]
            for product, model_names in brand_models.items():
                rng = random.Random(f"parts-{code}-{product}")
                for model_name in model_names:
                    if (brand_id, product_ids[product], model_name) not in models:
                        await self._upsert(
                            "product_brand_model",
                            {"brand_id": brand_id, "model_name": model_name, "product_id": product_ids[product]},
                        )
                hsn = cat.PRODUCTS[product][1]
                for n, (part_name, cost) in enumerate(cat.PARTS[product], start=1):
                    if (brand_id, product, part_name) in parts:
                        continue
                    cost_price = _money(cost * rng.uniform(0.9, 1.15))
                    new_parts.append(
                        await self._upsert(
                            "spare_part_master",
                            {
                                "brand_id": brand_id,
                                "category": product,
                                "cost_price": cost_price,
                                "hsn_code": hsn,
                                "part_code": f"{code[:3]}-{product[:2].upper()}{n:02d}",
                                "part_name": part_name,
                                "selling_price": _money(cost_price * MARKUP),
                                "uom": "Nos",
                            },
                        )
                    )
        return new_parts

    async def _new_customer(self, rng: random.Random) -> int:
        first, last = rng.choice(cat.FIRST_NAMES), rng.choice(cat.LAST_NAMES)
        locality, pin = rng.choice(cat.LOCALITIES)
        mobile = str(self.next_mobile)
        self.next_mobile += 1
        customer_id = await self._upsert(
            "customer_contact",
            {
                "address_line1": f"{rng.randint(1, 220)}, {locality} Road",
                "city": "Kolkata",
                "customer_type_id": 1,
                "email": f"{first.lower()}.{last.lower()}{mobile[-3:]}@example.com",
                "full_name": f"{first} {last}",
                "mobile": mobile,
                "postal_code": pin,
                "state_id": self.state_id,
            },
        )
        self.customers.append(customer_id)
        self.counts["customers"] += 1
        return customer_id

    # ── stock ────────────────────────────────────────────────────────────────

    async def _restock(self, day: date, force: bool = False) -> None:
        """A purchase invoice per brand whose parts ran low (always, with force)."""
        stock = {r["part_id"]: float(r["qty"] or 0) for r in await self._q(DemoServerSql.GET_STOCK)}
        rng = random.Random(f"restock-{day}")
        by_brand: dict[int, list[dict]] = {}
        for part in self.parts:
            have = stock.get(part["id"], 0)
            if force or have < 3:
                by_brand.setdefault(part["brand_id"], []).append({**part, "need": STOCK_TARGET + 2 - int(have)})
        for brand_id, parts in by_brand.items():
            if not force and len(parts) < 2:
                continue
            await self._purchase(day, brand_id, parts, rng)

    async def _purchase(self, day: date, brand_id: int, parts: list[dict], rng: random.Random) -> None:
        purchase_type = self.ids["stock_type"]["PURCHASE"]
        lines, total = [], 0.0
        for part in parts:
            qty, price = part["need"], float(part["cost_price"])
            amount = _money(qty * price)
            total += amount
            lines.append(
                {
                    "aggregate_amount": amount,
                    "cgst_amount": 0,
                    "gst_rate": 0,
                    "hsn_code": part["hsn_code"],
                    "igst_amount": 0,
                    "part_id": part["id"],
                    "qty": qty,
                    "remarks": None,
                    "sgst_amount": 0,
                    "total_amount": amount,
                    "under_warranty": False,
                    "unit_price": price,
                    "xDetails": [
                        {
                            "fkeyName": "purchase_line_id",
                            "tableName": "stock_transaction",
                            "xData": [
                                {
                                    "branch_id": self.branch_id,
                                    "dr_cr": "D",
                                    "part_id": part["id"],
                                    "qty": qty,
                                    "stock_transaction_type_id": purchase_type,
                                    "transaction_date": day.isoformat(),
                                    "unit_cost": price,
                                }
                            ],
                        }
                    ],
                }
            )
        await self._upsert(
            "purchase_invoice",
            {
                "aggregate_amount": _money(total),
                "branch_id": self.branch_id,
                "brand_id": brand_id,
                "cgst_amount": 0,
                "division_id": self.division_id,
                "igst_amount": 0,
                "invoice_date": day.isoformat(),
                "invoice_no": f"DS/{day:%y%m%d}/{brand_id:02d}{rng.randint(10, 99)}",
                "is_return": False,
                "remarks": None,
                "sgst_amount": 0,
                "supplier_id": rng.choice(self.suppliers),
                "total_amount": _money(total),
                "total_tax": 0,
                "xDetails": {"fkeyName": "purchase_invoice_id", "tableName": "purchase_invoice_line", "xData": lines},
            },
        )
        self.counts["purchases"] += 1

    # ── one day ──────────────────────────────────────────────────────────────

    async def _simulate_day(self, day: date) -> None:
        rng = random.Random(f"day-{day}")
        if day.weekday() == 0:
            await self._restock(day)
        await self._advance_open_jobs(day)
        new_jobs = rng.randint(1, 2) if day.weekday() == 6 else rng.randint(2, 4)
        for _ in range(new_jobs):
            await self._new_job(day, rng)
        if rng.random() < 0.35:
            await self._counter_sale(day, rng)

    async def _new_job(self, day: date, rng: random.Random, models: list[dict] | None = None) -> None:
        customer_id = await self._new_customer(rng) if rng.random() < 0.3 else rng.choice(self.customers)
        model = rng.choice(models or self.models)
        job_type = rng.choices(
            ["MAKE_READY", "ESTIMATE", "UNDER_WARRANTY", "MAINTENANCE"], weights=[55, 20, 15, 10]
        )[0]
        problems = cat.PRODUCTS[model["product"]][0]
        await resolve_create_single_job_helper(
            self.db,
            self.schema,
            _encode(
                {
                    "tableName": "job",
                    "xData": {
                        "branch_id": self.branch_id,
                        "customer_contact_id": customer_id,
                        "division_id": self.division_id,
                        "job_date": day.isoformat(),
                        "job_receive_condition_id": rng.choice([2, 2, 3, 5, 10]),
                        "job_receive_manner_id": rng.choice([1, 1, 1, 2, 4, 9]),
                        "job_status_id": self.ids["status"]["RECEIVED"],
                        "job_type_id": self.ids["job_type"][job_type],
                        "performed_by_user_id": self.user_id,
                        "problem_reported": rng.choice(problems),
                        "product_brand_model_id": model["id"],
                        "qty": 1,
                        "serial_no": f"SN{rng.randint(10**7, 10**8 - 1)}",
                        "warranty_card_no": f"WC{rng.randint(10**5, 10**6 - 1)}" if job_type == "UNDER_WARRANTY" else None,
                    },
                }
            ),
            skip_usage=True,
        )
        self.counts["jobs"] += 1

    async def _advance_open_jobs(self, day: date) -> None:
        """Move each open job at most one step, once it has waited its turn."""
        status = self.ids["status"]
        code_of = {v: k for k, v in status.items()}
        for job in await self._q(DemoServerSql.GET_OPEN_JOBS):
            if job["job_date"] >= day:
                continue
            rng = random.Random(f"job-{job['id']}-{job['job_status_id']}-{job['is_final']}")
            waited = (day - job["last_date"]).days
            code = code_of.get(job["job_status_id"], "")
            if job["is_final"]:
                if waited >= rng.randint(1, 4):
                    await self._deliver(job, day, rng)
                continue
            if code in ("COMPLETED_OK", "RETURN"):
                if waited >= rng.randint(0, 1):
                    await self._finalize(job, code, rng)
                continue
            target = self._next_status(job, code, rng)
            if target and waited >= rng.randint(1, 3 if code != "PARTS_PENDING" else 6):
                await self._transition(job, target, day, rng)

    def _next_status(self, job: dict, code: str, rng: random.Random) -> str | None:  # pylint: disable=too-many-return-statements
        fate = random.Random(f"fate-{job['id']}").random()
        if code == "RECEIVED":
            return "ESTIMATED" if job["job_type_code"] == "ESTIMATE" else "ASSIGNED"
        if code == "ESTIMATED":
            return "ESTIMATE_REJECTED" if fate < 0.2 else "ESTIMATE_APPROVED"
        if code == "ESTIMATE_REJECTED":
            return "RETURN"
        if code in ("ASSIGNED", "ESTIMATE_APPROVED", "PARTS_PENDING"):
            return "IN_PROGRESS"
        if code == "IN_PROGRESS":
            if 0.2 <= fate < 0.35 and rng.random() < 0.6:
                return "PARTS_PENDING"
            return "RETURN" if fate > 0.93 else "COMPLETED_OK"
        return None

    async def _transition(self, job: dict, target: str, day: date, rng: random.Random) -> None:
        target_id = self.ids["status"][target]
        technician = job["technician_id"] or (rng.choice(self.technicians) if self.technicians else None)
        estimate = job["estimate_amount"]
        if target == "ESTIMATED":
            estimate = rng.randrange(800, 4000, 50)
        await resolve_update_job_helper(
            self.db,
            self.schema,
            _encode(
                {
                    "job_id": job["id"],
                    "last_transaction_id": job["last_transaction_id"],
                    "performed_by_user_id": self.user_id,
                    "remarks": "",
                    "transaction_date": day.isoformat(),
                    "xData": {
                        "amount": job["amount"],
                        "division_id": self.division_id,
                        "estimate_amount": estimate,
                        "id": job["id"],
                        "is_closed": False,
                        "is_final": False,
                        "job_status_id": target_id,
                        "technician_id": technician,
                    },
                }
            ),
        )

    async def _finalize(self, job: dict, code: str, rng: random.Random) -> None:  # pylint: disable=too-many-locals
        """Mark final with parts and charges, the way Final a Job saves."""
        warranty = job["job_type_code"] == "UNDER_WARRANTY"
        parts_used, charges = [], []
        if code == "COMPLETED_OK":
            candidates = [p for p in self.parts if p["brand_id"] == job["brand_id"] and p["category"] == job["product"]]
            for part in rng.sample(candidates, k=min(len(candidates), rng.choice([0, 1, 1, 2]))):
                cost = float(part["cost_price"])
                parts_used.append(
                    {
                        "cost_price": cost,
                        "gst_rate": 0,
                        "hsn_code": None,
                        "part_id": part["id"],
                        "qty": 1,
                        "remarks": None,
                        "selling_price": 0 if warranty else _money(cost * MARKUP),
                        "xDetails": {
                            "fkeyName": "job_part_used_id",
                            "tableName": "stock_transaction",
                            "xData": {
                                "branch_id": self.branch_id,
                                "dr_cr": "C",
                                "part_id": part["id"],
                                "qty": 1,
                                "remarks": None,
                                "stock_transaction_type_id": self.ids["stock_type"]["CONSUMPTION"],
                                "transaction_date": job["job_date"].isoformat(),
                            },
                        },
                    }
                )
            low, high = cat.LABOUR[job["product"]]
            labour = 0 if warranty else rng.randrange(low, high + 1, 50)
            charges.append(self._charge("Labour Charge", labour))
        elif not warranty:
            charges.append(self._charge("Inspection Fee", rng.choice([150, 200, 250])))
        amount = sum(p["selling_price"] * p["qty"] for p in parts_used) + sum(c["selling_price"] for c in charges)
        x_details: list[dict] = []
        if parts_used:
            x_details.append({"fkeyName": "job_id", "tableName": "job_part_used", "xData": parts_used})
        x_details.append({"fkeyName": "job_id", "tableName": "job_additional_charge", "xData": charges})
        await self._upsert(
            "job",
            {
                "amount": _money(amount),
                "division_id": self.division_id,
                "id": job["id"],
                "is_final": True,
                "is_igst": False,
                "to_set_updated_at": True,
                "to_show_parts_in_job_invoice": True,
                "xDetails": x_details,
            },
        )

    @staticmethod
    def _charge(name: str, price: float) -> dict:
        return {
            "charge_name": name,
            "cost_price": 0,
            "description": None,
            "gst_rate": 0,
            "hsn_code": None,
            "qty": 1,
            "ref_no": None,
            "selling_price": price,
        }

    async def _deliver(self, job: dict, day: date, rng: random.Random) -> None:
        """Receipt, delivery and invoice, the way the Deliver screen does them."""
        amount = float(job["amount"] or 0)
        if amount > 0:
            paid = rng.random() < 0.9
            await resolve_create_job_payment_helper(
                self.db,
                self.schema,
                _encode(
                    {
                        "xData": {
                            "amount": amount if paid else _money(amount / 2),
                            "branch_id": self.branch_id,
                            "job_id": job["id"],
                            "payment_date": day.isoformat(),
                            "payment_mode": rng.choice(["Cash", "Cash", "UPI", "UPI", "Card"]),
                            "reference_no": None,
                            "remarks": None,
                        }
                    }
                ),
            )
            self.counts["receipts"] += 1
        completed = job["job_status_id"] == self.ids["status"]["COMPLETED_OK"]
        delivered = "DELIVERED_OK" if completed else "DELIVERED_NOT_OK"
        txn_id = await resolve_deliver_job_helper(
            self.db,
            self.schema,
            _encode(
                {
                    "delivered_status_id": self.ids["status"][delivered],
                    "delivery_date": day.isoformat(),
                    "delivery_manner_name": "Self",
                    "job_id": job["id"],
                    "last_transaction_id": job["last_transaction_id"],
                    "payment": {"amount": 0, "payment_date": day.isoformat(), "payment_mode": "Cash"},
                    "performed_by_user_id": self.user_id,
                    "remarks": "",
                }
            ),
        )
        # deliverJob stamps today's date on its history row; this run is replaying an earlier day.
        if txn_id:
            await self._upsert("job_transaction", {"id": txn_id, "transaction_date": day.isoformat()})
        self.counts["deliveries"] += 1
        if amount > 0:
            await self._invoice(job, day)

    async def _invoice(self, job: dict, day: date) -> None:
        parts = await self._q(DemoServerSql.GET_JOB_PARTS, {"job_id": job["id"]})
        charges = await self._q(DemoServerSql.GET_JOB_CHARGES, {"job_id": job["id"]})
        lines = []
        for p in parts:
            taxable = _money(float(p["selling_price"]) * float(p["qty"]))
            lines.append(self._invoice_line(p["part_name"], p["part_code"], p["qty"], p["selling_price"], taxable))
        for c in charges:
            taxable = _money(float(c["selling_price"] or 0) * float(c["qty"] or 1))
            lines.append(self._invoice_line(c["charge_name"], None, c["qty"] or 1, c["selling_price"] or 0, taxable))
        total = _money(sum(line["amount"] for line in lines))
        if not lines or total <= 0:
            return
        await resolve_create_job_invoice_helper(
            self.db,
            self.schema,
            _encode(
                {
                    "tableName": "job_invoice",
                    "xData": {
                        "aggregate": total,
                        "amount": total,
                        "branch_id": self.branch_id,
                        "cgst_amount": 0,
                        "division_id": self.division_id,
                        "igst_amount": 0,
                        "invoice_date": day.isoformat(),
                        "job_id": job["id"],
                        "sgst_amount": 0,
                        "supply_state_code": "",
                        "xDetails": [{"fkeyName": "job_invoice_id", "tableName": "job_invoice_line", "xData": lines}],
                    },
                }
            ),
        )

    @staticmethod
    def _invoice_line(description: str, part_code: str | None, qty: Any, price: Any, taxable: float) -> dict:
        return {
            "aggregate": taxable,
            "amount": taxable,
            "cgst_amount": 0,
            "description": description,
            "gst_rate": 0,
            "hsn_code": None,
            "igst_amount": 0,
            "part_code": part_code,
            "price": float(price),
            "qty": float(qty),
            "sgst_amount": 0,
        }

    async def _counter_sale(self, day: date, rng: random.Random) -> None:
        """A walk-in customer buys one or two parts of one brand over the counter."""
        stock = {r["part_id"]: float(r["qty"] or 0) for r in await self._q(DemoServerSql.GET_STOCK)}
        in_stock = [p for p in self.parts if stock.get(p["id"], 0) >= 2]
        if not in_stock or not self.customers:
            return
        brand_id = rng.choice(in_stock)["brand_id"]
        brand_parts = [p for p in in_stock if p["brand_id"] == brand_id]
        chosen = rng.sample(brand_parts, k=min(len(brand_parts), 2 if rng.random() < 0.3 else 1))
        customer_id = rng.choice(self.customers)
        customer = (await self._q(DemoServerSql.GET_CUSTOMER_NAME, {"id": customer_id}))[0]
        lines, total = [], 0.0
        for part in chosen:
            price = _money(float(part["cost_price"]) * MARKUP)
            total += price
            lines.append(
                {
                    "amount": price,
                    "cgst_amount": 0,
                    "cost_price": float(part["cost_price"]),
                    "gst_rate": 0,
                    "hsn_code": part["hsn_code"],
                    "igst_amount": 0,
                    "item_description": part["part_name"],
                    "part_id": part["id"],
                    "price": price,
                    "qty": 1,
                    "remarks": None,
                    "sgst_amount": 0,
                    "xDetails": [
                        {
                            "fkeyName": "sales_line_id",
                            "tableName": "stock_transaction",
                            "xData": [
                                {
                                    "branch_id": self.branch_id,
                                    "dr_cr": "C",
                                    "part_id": part["id"],
                                    "qty": 1,
                                    "stock_transaction_type_id": self.ids["stock_type"]["SALES"],
                                    "transaction_date": day.isoformat(),
                                    "unit_cost": price,
                                }
                            ],
                        }
                    ],
                }
            )
        await resolve_create_sales_invoice_helper(
            self.db,
            self.schema,
            _encode(
                {
                    "branch_id": self.branch_id,
                    "division_id": self.division_id,
                    "tableName": "sales_invoice",
                    "xData": {
                        "aggregate": _money(total),
                        "amount": _money(total),
                        "brand_id": brand_id,
                        "cgst_amount": 0,
                        "customer_contact_id": customer_id,
                        "customer_gstin": None,
                        "customer_name": customer["full_name"],
                        "customer_state_code": self.state_gst,
                        "division_id": self.division_id,
                        "igst_amount": 0,
                        "invoice_date": day.isoformat(),
                        "is_return": False,
                        "remarks": None,
                        "sgst_amount": 0,
                        "xDetails": {"fkeyName": "sales_invoice_id", "tableName": "sales_invoice_line", "xData": lines},
                    },
                }
            ),
        )
        self.counts["sales"] += 1
