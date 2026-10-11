# Plan — Monthly job and WhatsApp limits per plan

## Goal
- Every plan has two monthly allowances: **new jobs** and **WhatsApp messages**.
- When a BU has used its job allowance for the month, creating a new job is refused.
- When a BU has used its WhatsApp allowance for the month, sending a WhatsApp message is refused.
- Decisions already made:
    - The period is a **calendar month, IST** (1st 00:00 to month end). Usage resets on the 1st.
    - Over the limit means **block**, not warn.
    - Limits are not secrets. Plan defaults live in the server `.env` (next to the prices); the effective limit is **stamped on `security.bu`** when a plan is set, exactly like `branch_limit` and `monthly_fee_paise`.
    - `NULL` limit = unlimited.
- Decisions made in this plan (change them in Step 0 if you disagree):
    - A job counts when it is created. Deleting it later does **not** give the count back.
    - Opening jobs (migrated old data) and edits to existing jobs do **not** count.
    - A WhatsApp message counts when it is handed to Meta and accepted. A message that fails to send is given back.
    - Usage is per BU (per schema), not per customer. An Enterprise customer with five BUs gets the allowance five times.

## Present context and current design
- **No limit exists today** for jobs or WhatsApp messages. Plan data is: `plan_code`, `billing_required`, `monthly_fee_paise`, `paid_through`, `billing_hold`, `branch_limit` on `security.bu`.
- **Prices** come from `app/core/plan_prices.py` (`PlanPriceSettings`, `.env` keys, defaults in code). A change affects only new customers and new payments, because the values are stamped on the BU when it is approved or its plan changes.
- **Stamping points** (all write the plan fields of one BU):
    - Sign-up approval: `set_bu_plan` in `app/graphql/resolvers/bu_admin/signups.py` with `SignupServerSql.SET_BU_PLAN`.
    - Plan change: `BillingServerSql.SET_BU_PLAN_FIELDS` in `app/graphql/resolvers/bu_admin/billing.py`.
    - Start billing of an existing BU: `BillingServerSql.START_BU_BILLING` (Enterprise).
- **Write guard**: `require_bu_writable` in `app/graphql/resolvers/auth_guards.py` refuses writes to a view-only BU. Its status is read through `app/services/bu_billing.py` (`get_bu_billing`, cached 60 s). Usage changes on every job, so it must **not** go through this cache.
- **Branch limit** is the model to copy: `resolve_add_branch` locks the `security.bu` row and refuses with `CodedValidationException` code `BRANCH_LIMIT_REACHED`. The client turns that code into a dialog in `lib/apollo-client.ts` (`showBillingNotice`).
- **Job creation** has exactly two server paths, both in `app/graphql/resolvers/jobs/mutations.py`: `resolve_create_single_job_helper` (`createSingleJob`, one job) and `resolve_create_job_batch_helper` (`createJobBatch`, N jobs). Both run inside one DB transaction on one cursor.
- **WhatsApp sending** has seven `send_template(...)` call sites: `app/whatsapp/sender.py` lines ~352 (completion), ~400 (job intake), ~452 (delivery summary), ~484 (delivery OTP), ~833 (money receipt), ~933 (invoice) and `app/whatsapp/ew_sender.py` line ~141 (extended-warranty lead alert and reminders). Each `_persist_attempt` writes a per-job JSON in `job.whatsapp_notifications`; that is per job and event, not usable as a monthly counter.
- **Client** keeps the BU's billing summary in `store/context-slice.ts` (`billing`: status, paidThrough, planCode, branchLimit), filled by `components/shared/billing/use-billing-sync.ts` from the `buBillingStatus` query.

## New design brief
- Plan limits in `.env` and a helper that reads them — Step 1.
- Two limit columns on `security.bu` and a monthly usage table `security.bu_usage` — Step 2.
- Limits stamped at approval, plan change and start-billing — Step 3.
- One atomic "reserve usage" SQL and a small usage service — Step 4.
- Job creation refuses at the limit — Step 5.
- WhatsApp sending refuses at the limit and gives back failed sends — Step 6.
- `buBillingStatus` also returns limits and this month's usage — Step 7.
- Client shows usage, disables Save and shows the limit message — Step 8.
- Help articles (client and developer) — Step 9.
- Verification — Step 10.

## Key constraints of new design
1. **Two concurrent requests must not both take the last slot.** Resolution: reserve with one `INSERT … ON CONFLICT DO UPDATE … WHERE used + n <= limit` statement; no read-then-write (Step 4).
2. **A failed job creation must not eat the allowance.** Resolution: the job reservation runs on the same cursor and transaction as the job insert, so a rollback undoes it (Step 5).
3. **A failed WhatsApp send must not eat the allowance.** Resolution: reserve before sending (to stop races), release if Meta did not accept (Step 6).
4. **The browser is never trusted.** Resolution: all counting and refusal is server-side; the client only displays and pre-disables (Steps 5–8).
5. **Changing `.env` must not change a paying customer's allowance mid-term.** Resolution: the limit is stamped on `security.bu` at approval or plan change; `.env` is only read at those moments (Steps 1, 3).
6. **Existing BUs must keep working.** Resolution: columns are nullable; `NULL` = unlimited, so every BU stays unlimited until its plan is next set. Lite BUs are backfilled in Step 0 (C).
7. **Super Admin must not be blocked.** Resolution: same exemption as `require_bu_writable` (user type `S`).
8. **The client must not be able to write the new columns through `genericUpdate`.** Resolution: add them to `BU_BILLING_COLUMNS` and `bu_usage` to `SECURITY_SERVER_ONLY_TABLES` (Step 3).
9. **Generated type files are never hand-edited.** Resolution: Step 0 (B) regenerates them after the migration.

## Step 0 — Your Part
**A. Decide the numbers (before Step 1).** The defaults below are proposals; I have no data on your cost per message. Reply with changes, or accept.

| Plan | Jobs / month | WhatsApp / month |
|---|---|---|
| Lite | 50 | 0 |
| Basic | 300 | 300 |
| Standard | 1000 | 1000 |
| Enterprise | unlimited | 3000 per BU |

(Blank in `.env` = unlimited.) Also confirm the three "decisions made in this plan" in the Goal.

**B. Run the migration (after Step 2 is written, before Step 3 is deployed).**
- Run `plans/migrate-usage-limits.sql` (created in Step 2) on `service_plus_service` and on **every tenant database** (`security` schema exists in each).
- Then run `pnpm gen-types-all` in the client folder to refresh `src/types/db-schema-security.ts`. The `.env` reads are blocked for Claude, so this is yours.
- Also refresh `service-plus-server/app/db/schema_dumps/service_plus_service.sql` with `app/db/tools/extract_schema.py`.

**C. Backfill existing Lite BUs (after B).** Step 2's migration file ends with a commented `UPDATE` that stamps Lite limits on BUs whose `plan_code = 'lite'`. Uncomment and run it once per tenant database if you want existing Lite BUs limited too. Skip it to leave them unlimited.

**D. Add the `.env` keys (before Step 3 is deployed)** to the server `.env`, using the numbers from A. Key names are in Step 1.

## Step 1 — Plan limits from `.env`
Needs: Your Part A.
- **Explanation:** Mirror the price list. A new settings class reads the four plan rows; `get_plan_limits(plan_code)` returns the limits to stamp. Blank or missing key = unlimited (`None`). Defaults in code are the Step 0 table so a missing `.env` still works.
- **Path:** `service-plus-server/app/core/plan_prices.py` (add below `PlanPriceSettings`; do not touch the price code).
- **Code — old:** none (new).
- **Code — new:**
```python
class PlanLimitSettings(BaseSettings):
    """Monthly allowances from .env; blank = unlimited."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore"
    )

    limit_basic_jobs: int | None = Field(default=300, ge=0)
    limit_basic_whatsapp: int | None = Field(default=300, ge=0)
    limit_enterprise_jobs: int | None = Field(default=None, ge=0)
    limit_enterprise_whatsapp: int | None = Field(default=3000, ge=0)
    limit_lite_jobs: int | None = Field(default=50, ge=0)
    limit_lite_whatsapp: int | None = Field(default=0, ge=0)
    limit_standard_jobs: int | None = Field(default=1000, ge=0)
    limit_standard_whatsapp: int | None = Field(default=1000, ge=0)


@dataclass(frozen=True)
class PlanLimitType:
    """One plan's monthly allowances; None = unlimited."""

    jobs: int | None
    whatsapp: int | None


def get_plan_limits(plan_code: str) -> PlanLimitType:
    """The allowances to stamp on a BU of this plan. Read fresh from .env on each call."""
    s = PlanLimitSettings()
    return PlanLimitType(
        jobs=getattr(s, f"limit_{plan_code}_jobs"),
        whatsapp=getattr(s, f"limit_{plan_code}_whatsapp"),
    )
```
- Note: pydantic treats an empty `.env` value for `int | None` as a parse error; document in the dev article that "unlimited" is written by **deleting** the key (for keys whose default is a number, set a very large number such as `999999`). If you prefer a blank to mean unlimited, add a `field_validator(mode="before")` turning `""` into `None`.

## Step 2 — Schema: limit columns and usage table
Needs: Step 1.
- **Explanation:** Two nullable limit columns on `security.bu`. One row per BU per month in `security.bu_usage` holds the counters. `period_start` is the first day of the IST month. A new tenant gets these from the DDL file; existing tenants get them from the migration file.
- **Path:** `service-plus-server/app/db/sql/sql_bu_admin_ddl.py` (the `security.bu` create at ~line 40 and a new table after it); new file `plans/migrate-usage-limits.sql`.
- **Code — old** (in the `bu` create, after `branch_limit integer,`):
```sql
            branch_limit integer,
```
- **Code — new:**
```sql
            branch_limit integer,
            job_limit_monthly integer,
            whatsapp_limit_monthly integer,
```
  and with the other constraints:
```sql
            CONSTRAINT bu_job_limit_check CHECK (((job_limit_monthly IS NULL) OR (job_limit_monthly >= 0))),
            CONSTRAINT bu_whatsapp_limit_check CHECK (((whatsapp_limit_monthly IS NULL) OR (whatsapp_limit_monthly >= 0))),
```
- **New table (same DDL file, and the migration file):**
```sql
CREATE TABLE IF NOT EXISTS security.bu_usage (
    bu_id bigint NOT NULL REFERENCES security.bu(id) ON DELETE CASCADE,
    period_start date NOT NULL,
    jobs_used integer NOT NULL DEFAULT 0 CHECK (jobs_used >= 0),
    whatsapp_used integer NOT NULL DEFAULT 0 CHECK (whatsapp_used >= 0),
    PRIMARY KEY (bu_id, period_start)
);
```
- **Migration file** (`plans/migrate-usage-limits.sql`): `ALTER TABLE security.bu ADD COLUMN IF NOT EXISTS job_limit_monthly integer, ADD COLUMN IF NOT EXISTS whatsapp_limit_monthly integer;` plus the two CHECK constraints (guard with `DO $$ … IF NOT EXISTS` or drop-if-exists first), the table above, and at the end the commented Lite backfill used by Your Part C:
```sql
-- UPDATE security.bu SET job_limit_monthly = 50, whatsapp_limit_monthly = 0 WHERE plan_code = 'lite';
```
- Also register the table for new BU/tenant creation wherever `security` tables are listed (check `app/db/seeds/seed_security_data.py` and `app/db/schema_dumps/service_plus_service.sql` comment header) so a freshly created tenant has it.

## Step 3 — Stamp the limits and protect the columns
Needs: Step 2, Your Part B.
- **Explanation:** Whenever a plan is set, copy `get_plan_limits(plan)` onto the BU. Add the columns to the write-protection list so the browser cannot set them.
- **Path / code (four edits):**
  1. `service-plus-server/app/db/sql/sql_billing.py` `SET_BU_PLAN_FIELDS` — old:
```sql
        SET plan_code = %(plan_code)s, branch_limit = %(branch_limit)s,
```
  new:
```sql
        SET plan_code = %(plan_code)s, branch_limit = %(branch_limit)s,
            job_limit_monthly = %(job_limit)s, whatsapp_limit_monthly = %(whatsapp_limit)s,
```
  and `START_BU_BILLING` — old `SET plan_code = 'enterprise', billing_required = true, branch_limit = NULL,` new add `job_limit_monthly = %(job_limit)s, whatsapp_limit_monthly = %(whatsapp_limit)s,`.
  2. `service-plus-server/app/graphql/resolvers/bu_admin/billing.py` (~line 196, and the start-billing call) — add to the parameter dict: `"job_limit": limits.jobs, "whatsapp_limit": limits.whatsapp,` where `limits = get_plan_limits(new_plan)` (`"enterprise"` for start-billing).
  3. `service-plus-server/app/graphql/resolvers/bu_admin/signups.py` `set_bu_plan` (~line 220) and `SignupServerSql.SET_BU_PLAN` in `app/db/sql/sql_signups.py` — same two columns and parameters.
  4. `service-plus-server/app/graphql/resolvers/auth_guards.py` — in `BU_BILLING_COLUMNS` add `"job_limit_monthly"` and `"whatsapp_limit_monthly"` (alphabetical); in `SECURITY_SERVER_ONLY_TABLES` add `"bu_usage"` (alphabetical: `{"bu_payment", "bu_usage", "job_internal_note", "sales_enquiry"}`).
- After a plan change the cached billing summary is cleared by the existing `clear_bu_billing`; nothing extra needed.

## Step 4 — Usage service (atomic reserve and release)
Needs: Step 2.
- **Explanation:** One SQL per counter. `reserve` inserts the month's row or adds to it, but only if the new total stays within the BU's limit. No returned row = limit reached. `release` subtracts (never below 0). A plain `LimitReachedType` result is returned instead of raising, so each caller chooses how to refuse.
- **Path:** SQL in `service-plus-server/app/db/sql/sql_billing.py` (class `BillingServerSql`); service in new file `service-plus-server/app/services/bu_usage.py`.
- **Code — new SQL** (shown for jobs; the WhatsApp one is identical with `whatsapp`):
```sql
    RESERVE_JOBS = """
        INSERT INTO security.bu_usage (bu_id, period_start, jobs_used)
        SELECT b.id, %(period_start)s, %(n)s
        FROM security.bu b
        WHERE LOWER(b.code) = LOWER(%(code)s::text)
          AND (b.job_limit_monthly IS NULL OR %(n)s <= b.job_limit_monthly)
        ON CONFLICT (bu_id, period_start) DO UPDATE
        SET jobs_used = security.bu_usage.jobs_used + EXCLUDED.jobs_used
        WHERE (SELECT job_limit_monthly FROM security.bu WHERE id = security.bu_usage.bu_id) IS NULL
           OR security.bu_usage.jobs_used + EXCLUDED.jobs_used
              <= (SELECT job_limit_monthly FROM security.bu WHERE id = security.bu_usage.bu_id)
        RETURNING jobs_used
    """
    RELEASE_WHATSAPP = """
        UPDATE security.bu_usage
        SET whatsapp_used = GREATEST(whatsapp_used - %(n)s, 0)
        WHERE bu_id = (SELECT id FROM security.bu WHERE LOWER(code) = LOWER(%(code)s::text))
          AND period_start = %(period_start)s
    """
    GET_BU_USAGE = """
        SELECT b.job_limit_monthly, b.whatsapp_limit_monthly,
               COALESCE(u.jobs_used, 0) AS jobs_used, COALESCE(u.whatsapp_used, 0) AS whatsapp_used
        FROM security.bu b
        LEFT JOIN security.bu_usage u ON u.bu_id = b.id AND u.period_start = %(period_start)s
        WHERE LOWER(b.code) = LOWER(%(code)s::text)
    """
```
- **Code — new service:**
```python
def month_start_ist() -> date:
    return today_ist().replace(day=1)


async def reserve_jobs(cur, schema: str, n: int) -> bool:
    """True when n more jobs fit in this month's allowance. Runs on the caller's cursor,
    so a rollback of the job insert also undoes the reservation."""
    await cur.execute(BillingServerSql.RESERVE_JOBS, {"code": schema, "n": n, "period_start": month_start_ist()})
    return await cur.fetchone() is not None


async def reserve_whatsapp(db_name: str, schema: str, n: int = 1) -> bool: ...   # exec_sql, own transaction
async def release_whatsapp(db_name: str, schema: str, n: int = 1) -> None: ...
async def get_bu_usage(db_name: str, schema: str) -> dict: ...                   # Step 7
```
- **Caveat:** the `search_path` of the job cursor is the BU schema, so every table in these SQLs is `security.`-qualified (as written).
- Super Admin and tenant-wide schemas (`security`, `public`, empty) are never counted; the callers skip when `require_bu_writable` would skip.

## Step 5 — Block new jobs at the limit
Needs: Step 4.
- **Explanation:** After `branch_id` is validated and the cursor's `search_path` is set, reserve `1` (single job) or `len(jobs)` (batch). If the reservation fails, raise the new coded error; nothing is written. A batch that does not fit is refused whole — no partial batch. Add the error text and code.
- **Path:** `service-plus-server/app/graphql/resolvers/jobs/mutations.py` in `resolve_create_single_job_helper` (~line 120, before `CLAIM_NEXT_JOB_NUMBER`) and `resolve_create_job_batch_helper` (~line 610, before `CLAIM_NEXT_BATCH_NUMBER`); `service-plus-server/app/core/exceptions.py`.
- **Code — old** (batch helper):
```python
            await cur.execute(SqlStore.CLAIM_NEXT_BATCH_NUMBER)
```
- **Code — new:**
```python
            if not await reserve_jobs(cur, schema_name, len(jobs)):
                raise CodedValidationException(
                    message=AppMessages.JOB_LIMIT_REACHED,
                    code="JOB_LIMIT_REACHED",
                    extensions={"requested": len(jobs)},
                )
            await cur.execute(SqlStore.CLAIM_NEXT_BATCH_NUMBER)
```
  Single-job helper: same block with `1`, placed before the `# 1. Claim next sequence number atomically` step.
- **Exemption:** the resolvers `createSingleJob`/`createJobBatch` in `mutation.py` know the user type; pass `skip_usage = info.context.get("user_type") == "S"` into the helpers (or skip the reservation inside when set). Keep the helper signature change minimal.
- **Message** in `app/core/exceptions.py` next to `SUBSCRIPTION_READ_ONLY`:
```python
    JOB_LIMIT_REACHED = "This business unit has used all the jobs included in its plan for this month. The limit resets on the 1st."
```
- **Verification of "only two creation paths":** `grep -rn "INSERT INTO job\b\|\"job\"" app/graphql` must show creation only in these helpers (the `process_data(..., "job", ...)` calls at ~223/321 are updates; the client's `genericUpdate` with `tableName: "job"` in `single-job-section.tsx` ~228/261 must be checked: if either is an insert with no `id`, add the same reservation to that path or route it through `createSingleJob`).

## Step 6 — Block WhatsApp sends at the limit
Needs: Step 4.
- **Explanation:** Wrap `send_template` once so every one of the seven call sites is covered: a new function `send_metered(db_name, schema, ...)` calls `reserve_whatsapp`; if refused it returns a `SendResult`-shaped value with `ok=False` and error `WHATSAPP_LIMIT_REACHED` **without calling Meta**; otherwise it calls `send_template`, and releases the reservation when `result.ok` is false. The existing code already turns `ok=False` into status `FAILED` and persists it; the new error code lets the UI tell "limit" from "Meta error".
- **Path:** `service-plus-server/app/whatsapp/client.py` (or a new `app/whatsapp/metered.py` to keep `client.py` free of DB imports — preferred), call sites in `app/whatsapp/sender.py` (6) and `app/whatsapp/ew_sender.py` (1).
- **Code — old** (`sender.py` ~352):
```python
        result = await send_template(
            normalize_mobile(mobile), template, header_values, body_values, callback_data
        )
```
- **Code — new:**
```python
        result = await send_metered(
            db_name, schema, normalize_mobile(mobile), template, header_values, body_values, callback_data
        )
```
  and in `metered.py`:
```python
async def send_metered(db_name, schema, *args, **kwargs):
    if not await reserve_whatsapp(db_name, schema):
        return SendResultType(ok=False, error_code="WHATSAPP_LIMIT_REACHED",
                              error_message=AppMessages.WHATSAPP_LIMIT_REACHED, provider_message_id=None)
    result = await send_template(*args, **kwargs)
    if not result.ok:
        await release_whatsapp(db_name, schema)
    return result
```
  (Use the real field names of the result type in `client.py` ~line 33.)
- **What counts:** the delivery flow sends two messages (summary and OTP, lines ~452 and ~484). Each is metered; if the summary is accepted and the OTP is refused the job delivery still shows "OTP not sent" through the existing failure path — document this in the dev article. Money receipts and invoices are single messages.
- **Message:** `WHATSAPP_LIMIT_REACHED = "This business unit has used all the WhatsApp messages included in its plan for this month. The limit resets on the 1st."` in `exceptions.py`.
- **Do not meter** the Super Admin's own tenant (the same `user_type == "S"` skip is not available here because the helpers get only `db_name`/`schema`; accept that Super Admin sends count — note in the dev article) and the webhook status callbacks (they send nothing).

## Step 7 — Return limits and usage to the client
Needs: Step 4, Step 3.
- **Explanation:** `buBillingStatus` already exists. Add `jobLimit`, `whatsappLimit`, `jobsUsed`, `whatsappUsed` to its result. Usage is read fresh each time (not through the 60-second cache).
- **Path:** `service-plus-server/app/graphql/resolvers/query.py` `resolve_bu_billing_status` (~line 85); `service-plus-server/app/services/bu_billing.py`.
- **Code — old:** returns `get_bu_billing(db_name, schema)`.
- **Code — new:**
```python
    billing = dict(await get_bu_billing(db_name, schema))
    usage = await get_bu_usage(db_name, schema)
    return {**billing, "jobLimit": usage["job_limit_monthly"], "jobsUsed": usage["jobs_used"],
            "whatsappLimit": usage["whatsapp_limit_monthly"], "whatsappUsed": usage["whatsapp_used"]}
```
  Update the GraphQL schema type for `buBillingStatus` (the `.graphql` file that declares it; grep `branchLimit` under `service-plus-server/app/graphql/`) with the four nullable `Int` fields.

## Step 8 — Client: show usage, disable Save, show the limit message
Needs: Step 7.
- **Explanation:** Four pieces.
  1. **Store.** Add the four fields to the billing type in `store/context-slice.ts` (next to `branchLimit`) and to the `buBillingStatus` query text in `constants/graphql-map.ts`. Add selectors `selectJobLimitReached` and `selectWhatsappLimitReached` (limit not null and used >= limit).
  2. **Error link.** `lib/apollo-client.ts` (~line 100) already recognises `SUBSCRIPTION_READ_ONLY` and `BRANCH_LIMIT_REACHED`; add `JOB_LIMIT_REACHED`, and extend the union in `context-slice.ts` (~line 27) and `read-only-dialog.tsx` so the dialog shows `MESSAGES.BILLING_JOB_LIMIT`. Refresh billing after it (existing `requestBillingRefresh`).
  3. **Job screens.** Where Save is disabled by `useIsReadOnly` (single job, batch job) also disable it when `selectJobLimitReached`, with tooltip `MESSAGES.BILLING_JOB_LIMIT`. Show a small line `Jobs this month: 42 / 50` (hidden when unlimited) on the job entry screen.
  4. **WhatsApp.** In Customer Connect (`jobs/customer-connect/customer-connect-section.tsx`) and the other send buttons, disable send when `selectWhatsappLimitReached` and show `Messages this month: 280 / 300`. A send result carrying error code `WHATSAPP_LIMIT_REACHED` shows a toast with `MESSAGES.BILLING_WHATSAPP_LIMIT` instead of the generic failure text.
- **Messages** (long text → `constants/messages.ts`, alphabetical among the `BILLING_*` keys):
```ts
	BILLING_JOB_LIMIT: "You have used all the jobs included in your plan for this month. The limit resets on the 1st. Upgrade your plan to add more.",
	BILLING_WHATSAPP_LIMIT: "You have used all the WhatsApp messages included in your plan for this month. The limit resets on the 1st.",
```
- Red is not used for these (errors only); use the amber style of the due-soon banner for the usage lines when above 90 %.
- Paths to touch: `src/store/context-slice.ts`, `src/constants/graphql-map.ts`, `src/constants/messages.ts`, `src/lib/apollo-client.ts`, `src/components/shared/billing/read-only-dialog.tsx`, `src/components/shared/billing/billing-types.ts` (if it types the status), the single-job and batch-job sections under `src/features/client/components/jobs/`, and the WhatsApp send buttons (grep `sendWhatsapp` in `src/`).

## Step 9 — Help articles
Needs: Steps 1–8.
- **Explanation:** Required by the project rules, both files, in the same change.
- **Path / content:**
  - `src/features/client/components/help/help-content.ts` — in the subscription/plan article: the monthly allowances per plan, what "used / limit" means, that the count resets on the 1st, that deleting a job does not give it back, what the message says when blocked, and that Super Admin / the provider can raise the limit by changing the plan.
  - `src/features/super-admin/components/help/dev-help-content.ts` — **one new article** "Monthly job and WhatsApp limits": `.env` keys (Step 1), `security.bu.job_limit_monthly` / `whatsapp_limit_monthly`, `security.bu_usage`, the three SQL ids `RESERVE_JOBS` / `RESERVE_WHATSAPP` / `RELEASE_WHATSAPP` / `GET_BU_USAGE`, `reserve_jobs` on the job cursor, `send_metered` wrapper and its seven call sites, error codes `JOB_LIMIT_REACHED` and `WHATSAPP_LIMIT_REACHED`, the stamping points, the two protected-column lists, the "delivery sends two messages" note, and the migration file. Then grep the neighbouring billing articles (`branch_limit`, `BU_BILLING_COLUMNS`, "refusal codes" at ~line 4996) and add the new columns/codes to their lists so counts and lists do not go stale.

## Step 10 — Verification
Needs: all steps.
- Server: with a Basic BU set to `job_limit_monthly = 2`, create 2 jobs, then a 3rd → `JOB_LIMIT_REACHED`; a batch of 2 when 1 remains → refused whole; a failed creation (bad job type) leaves `jobs_used` unchanged. Two parallel `createSingleJob` calls with 1 slot left → exactly one succeeds.
- WhatsApp: set `whatsapp_limit_monthly = 1`; first send accepted, second returns `WHATSAPP_LIMIT_REACHED` without a Meta call; force a Meta failure and confirm `whatsapp_used` is released.
- Month rollover: set `period_start` rows to last month and confirm a new row starts at 0 on the 1st.
- Browser: `bu_usage` and the limit columns cannot be written through `genericUpdate` (expect the existing billing-columns / server-only-table refusal).
- Client: `pnpm exec tsc -b --noEmit`, `pnpm lint`, `pnpm format` on touched files, then check the Save/Send disabled states and the usage lines in the browser.
