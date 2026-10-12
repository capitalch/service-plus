# Plan — Monthly job and WhatsApp limits for Lite, Basic and Standard

## Goal
- Make the three offers real. Each BU gets a monthly allowance (new numbers; the portal still shows the old ones until Step 1 updates it):

  | Plan | Jobs / month | WhatsApp / month | Users |
  |---|---|---|---|
  | Lite | 75 | 20 | 1 |
  | Basic | 150 | 150 | 1 |
  | Standard | 400 | 300 | many |

- When the allowance is used up, the action is **blocked** with a clear message. Nothing saved is lost.
- Staff can see "used / allowed" before they run out.
- Decisions:
    - Month = calendar month, India time. Usage resets on the 1st.
    - Counted per BU.
    - A job counts when it is created. Deleting it does not give it back. Opening jobs and edits do not count.
    - A WhatsApp message counts only when Meta accepts it.
    - Limits live in the server `.env` (defaults in code = the table above) and are **stamped on `security.bu`** whenever a plan is set, like `branch_limit`. Empty = unlimited.
    - Enterprise is out of scope: it stays unlimited (columns left empty).
    - Users: already done. Only Standard and Enterprise can add staff users (`plan_allows_user_management` in `staff_users.py`). No work here.

## Present context
- No job or WhatsApp limit exists. `security.bu` has `plan_code`, `branch_limit`, `billing_required`, `monthly_fee_paise`, `paid_through`, `billing_hold`.
- Plan values are written to the BU in four places: sign-up approval (`signups.py` → `SET_BU_PLAN`), plan change (`billing.py` → `SET_BU_PLAN_FIELDS`), start billing (`START_BU_BILLING`, Enterprise only), and a new BU of an Enterprise client (`app/services/enterprise_billing.py` → `COPY_CLIENT_BILLING_TO_BU`).
- The branch limit is the pattern to copy: server raises `CodedValidationException` code `BRANCH_LIMIT_REACHED`; client `lib/apollo-client.ts` turns the code into the billing dialog (`read-only-dialog.tsx`).
- Jobs are created in three server functions in `app/graphql/resolvers/jobs/mutations.py`: `resolve_create_single_job_helper` (also used for opening jobs), `resolve_create_job_batch_helper`, and `resolve_update_job_batch_helper` (its `addedJobs` add jobs to an existing batch). Each runs in one transaction on one cursor.
- WhatsApp goes out through `send_template` (`app/whatsapp/client.py`), called from seven places: `sender.py` (completion, job intake, delivery summary, delivery OTP, money receipt, invoice) and `ew_sender.py` (EW alert and reminders).
- The client gets BU status from the `buBillingStatus` query into `store/context-slice.ts` (`billing`).

## Logical workflow — how jobs and messages are checked and used

**Where the numbers live**
- `.env` → plan defaults. Read only when a plan is set.
- `security.bu.job_limit_monthly`, `whatsapp_limit_monthly` → this BU's allowance. Empty = unlimited.
- `security.bu_usage (bu_id, period_start, jobs_used, whatsapp_used)` → one row per BU per month. `period_start` = 1st of the current IST month. A new month simply starts a new row at 0, so no reset job is needed.

**Creating jobs**
1. Staff opens the job screen. The client already knows `jobsUsed / jobLimit`; if used ≥ limit, Save is disabled and the usage line explains why.
2. Staff saves N jobs (1 for single, N for a batch). Opening jobs skip steps 3–4.
3. Server, in the same transaction as the insert, runs one "reserve N" statement: add N to `jobs_used` **only if** `jobs_used + N ≤ limit`.
4. Reserved → jobs are inserted → commit. Not reserved → raise `JOB_LIMIT_REACHED`; nothing is written. A batch that does not fit is refused whole.
5. If the insert fails later, the rollback also undoes the reservation. So only saved jobs count.
6. Client shows the dialog on `JOB_LIMIT_REACHED` and refreshes billing, so the usage line updates.

**Sending WhatsApp**
1. A send is started by staff, or automatically (the job intake notice, the EW lead alert to the shop).
2. Server reserves the number of messages this send needs (delivery = 2: summary + OTP; completion to K customers = K).
3. Not reserved → Meta is **not** called; result is `ok=false`, code `WHATSAPP_LIMIT_REACHED`. It is recorded like any failed send.
4. Reserved → each message goes to Meta. Every message Meta rejects is given back (subtract 1).
5. Automatic sends (job intake notice) never block the job: the job stays saved, only the message fails.
6. EW reminders (sent when staff click Send) send as many as still fit; the rest are reported as not sent because of the monthly limit.
7. Delivery OTP blocked → staff uses the existing manual pickup confirmation.

**Changing plan**
- Upgrade/downgrade stamps the new plan's limits on the BU at once. This month's `bu_usage` row is kept, so an upgrade from Lite (used 75) to Basic leaves 75 more jobs.

**Who is never blocked**
- Super Admin (user type `S`) for jobs. Enterprise BUs (no limit). BUs whose limit columns are empty.

## New design brief
- Plan limits read from `.env` — Step 1.
- Limit columns, usage table, and the DDL for new tenants — Step 2.
- Limits stamped when a plan is set; columns protected from the browser — Step 3.
- Reserve / release service — Step 4.
- Job creation blocked at the limit — Step 5.
- WhatsApp sends blocked at the limit — Step 6.
- `buBillingStatus` returns limits and usage — Step 7.
- Client usage lines, disabled Save/Send, limit messages — Step 8.
- Help articles — Step 9.

## Key constraints
1. **Two saves at the same moment must not both take the last slot.** Resolution: one atomic `INSERT … ON CONFLICT DO UPDATE … WHERE used + n ≤ limit`; never read-then-write (Step 4).
2. **A failed job save must not use the allowance.** Resolution: reserve on the job's own cursor and transaction (Step 5).
3. **A failed WhatsApp send must not use the allowance.** Resolution: reserve before, give back on failure (Step 6).
4. **The browser is never trusted.** Resolution: counting and blocking are server-side; the client only shows and disables (Steps 5–8).
5. **An `.env` change must not alter a paying BU mid-term.** Resolution: limits are stamped on the BU when the plan is set (Step 3).
6. **Existing BUs keep working until migrated.** Resolution: columns are nullable, empty = unlimited; Your Part B stamps existing Lite/Basic/Standard BUs.
7. **The browser must not write the new columns or table via `genericUpdate`.** Resolution: add to `BU_BILLING_COLUMNS` and `SECURITY_SERVER_ONLY_TABLES` (Step 3).
8. **Generated type files are never hand-edited.** Resolution: Your Part C regenerates them.

## Step 0 — Your Part
- **A.** ✅ Numbers confirmed (Goal table). Nothing else is needed before the build.

## Step 1 — Plan limits from `.env` ✅
Needs: Your Part A.
- Add `PlanLimitSettings` and `get_plan_limits(plan_code) -> PlanLimitType(jobs, whatsapp)` below the price code. Defaults = Goal table; Enterprise both `None`. A blank `.env` value means unlimited (a `field_validator(mode="before")` turns `""` into `None`).
- Keys: `LIMIT_LITE_JOBS`, `LIMIT_LITE_WHATSAPP`, `LIMIT_BASIC_JOBS`, `LIMIT_BASIC_WHATSAPP`, `LIMIT_STANDARD_JOBS`, `LIMIT_STANDARD_WHATSAPP`, `LIMIT_ENTERPRISE_JOBS`, `LIMIT_ENTERPRISE_WHATSAPP`.
- Update `service-plus-portal/content/pricing.ts` to the same numbers: `jobsPerMonth` 75 / 150 / 400 and `whatsappPerMonth` 20 / 150 / 300 for Lite / Basic / Standard. Enterprise stays `jobsPerMonth: null`; its `whatsappPerMonth: 2000` is left as shown, although the server does not limit it. Add a comment in each file pointing to the other so the two lists stay the same.
- Path: `service-plus-server/app/core/plan_prices.py`.

### 🧑 Your Part D — `.env.example` and `.env` ✅
Needs: Step 1.
- Add the eight `LIMIT_*` keys from Step 1 to `service-plus-server/.env.example` (with the Goal-table values; Enterprise blank), and to `.env` only if you want values other than the defaults. Claude cannot read `.env*` files.

## Step 2 — Schema ✅
Needs: Step 1.
- `security.bu`: add `job_limit_monthly integer`, `whatsapp_limit_monthly integer`, each with a `>= 0` check.
- New table:
```sql
CREATE TABLE security.bu_usage (
    bu_id bigint NOT NULL REFERENCES security.bu(id) ON DELETE CASCADE,
    period_start date NOT NULL,
    jobs_used integer NOT NULL DEFAULT 0 CHECK (jobs_used >= 0),
    whatsapp_used integer NOT NULL DEFAULT 0 CHECK (whatsapp_used >= 0),
    PRIMARY KEY (bu_id, period_start)
);
```
- No code edit here: the DDL lives in `service-plus-server/scripts/run_plan_limits_ddl.py` (Your Part B). New tenants get it because `sql_bu_admin_ddl.py` is regenerated from the dump in Your Part C (that file is auto-generated, never hand-edited).

### 🧑 Your Part B — Run the migration ✅
Needs: Step 2.
- `cd dev/service-plus-server && ../../env/bin/python3.14 scripts/run_plan_limits_ddl.py --dry-run` (read the report), then again without `--dry-run`. It covers every tenant DB plus `service_plus_service`, stamps Lite/Basic/Standard BUs, and lists jobs already created this month.

### 🧑 Your Part C — Regenerate types ✅
Needs: Your Part B.
- `pnpm gen-types-all` in the client.
- Re-dump `service_plus_service` schema-only into `service-plus-server/app/db/schema_dumps/service_plus_service.sql` (`pg_dump --schema-only`, as you did last time), then run `scripts/extract_schema.sh` to regenerate `app/db/sql/sql_bu_admin_ddl.py`.

## Step 3 — Stamp limits and protect the columns ✅
Needs: Step 2, Your Part B.
- Add `job_limit_monthly = %(job_limit_monthly)s, whatsapp_limit_monthly = %(whatsapp_limit_monthly)s` to `SET_BU_PLAN_FIELDS`, `START_BU_BILLING` and `COPY_CLIENT_BILLING_TO_BU` (`app/db/sql/sql_billing.py`) and `SET_BU_PLAN` (`app/db/sql/sql_signups.py`).
- Pass `limits = get_plan_limits(plan)` into those calls in `app/graphql/resolvers/bu_admin/billing.py`, `signups.py` (`set_bu_plan`, used by sign-up and Enterprise approval) and `app/services/enterprise_billing.py` (`apply_new_bu_billing`; a BU copied from a client with no plan gets no limits).
- `app/graphql/resolvers/auth_guards.py`: add both columns to `BU_BILLING_COLUMNS`, and `"bu_usage"` to `SECURITY_SERVER_ONLY_TABLES`.

## Step 4 — Usage service ✅
Needs: Step 2.
- New SQL in `BillingServerSql`: `RESERVE_JOBS`, `RESERVE_WHATSAPP`, `RELEASE_WHATSAPP`, `GET_BU_USAGE`. All tables `security.`-qualified (the job cursor's `search_path` is the BU schema). Core of reserve:
```sql
INSERT INTO security.bu_usage (bu_id, period_start, jobs_used)
SELECT b.id, %(period_start)s, %(n)s FROM security.bu b
WHERE LOWER(b.code) = LOWER(%(code)s) AND (b.job_limit_monthly IS NULL OR %(n)s <= b.job_limit_monthly)
ON CONFLICT (bu_id, period_start) DO UPDATE
SET jobs_used = security.bu_usage.jobs_used + EXCLUDED.jobs_used
WHERE (SELECT job_limit_monthly FROM security.bu WHERE id = security.bu_usage.bu_id) IS NULL
   OR security.bu_usage.jobs_used + EXCLUDED.jobs_used
      <= (SELECT job_limit_monthly FROM security.bu WHERE id = security.bu_usage.bu_id)
RETURNING jobs_used
```
  No row returned = limit reached. Release = `GREATEST(used - n, 0)`.
- New file `app/services/bu_usage.py`: `reserve_jobs(cur, schema, n) -> bool` (caller's cursor), `reserve_whatsapp(db_name, schema, n) -> bool`, `release_whatsapp(db_name, schema, n)`, `get_bu_usage(db_name, schema)`. Period = `today_ist().replace(day=1)`. Schemas `security`, `public` or empty are never counted.

## Step 5 — Block jobs ✅
Needs: Step 4.
- In all three helpers in `jobs/mutations.py` (single, batch, and `updateJobBatch`'s `addedJobs`), right after `SET search_path` and before the number is claimed: if not an opening job and not Super Admin, `_reserve_jobs_or_refuse(cur, schema_name, n)` → `reserve_jobs`; on `False` it raises `CodedValidationException(code="JOB_LIMIT_REACHED", extensions={"requested": n})`.
- Super Admin flag: the resolvers in `mutation.py` pass `skip_usage=(user_type == "S")` to the helpers.
- Message in `app/core/exceptions.py`: "This business unit has used all the jobs in its plan for this month. The limit resets on the 1st."
- Checked: no other path inserts into `job`. To keep it that way, `refuse_job_insert` (called in `resolve_generic_update`) refuses a `genericUpdate` job row without `id` → `JOB_INSERT_VIA_JOB_SCREENS`.

## Step 6 — Block WhatsApp ✅
Needs: Step 4.
- New `app/whatsapp/metered.py`: `send_metered(db_name, schema, *args)` → reserve 1, refuse with `ok=False, error_code="WHATSAPP_LIMIT_REACHED"` without calling Meta, else `send_template` and release on failure.
- Replace the seven `send_template` calls with `send_metered`. For the multi-message sends (completion to K customers, delivery summary + OTP), reserve all K first with `reserve_whatsapp(n=K)`; refuse the whole send if they don't fit; release each one Meta rejects. EW reminders: reserve as many as fit (`reserve_whatsapp_up_to`); the rest return status `LIMIT`.
- Message: "This business unit has used all the WhatsApp messages in its plan for this month. The limit resets on the 1st."

## Step 7 — Send limits and usage to the client ✅
Needs: Steps 3, 4.
- `resolve_bu_billing_status` (`app/graphql/resolvers/query.py`): add `jobLimit`, `jobsUsed`, `whatsappLimit`, `whatsappUsed` from `get_bu_usage` (read fresh, not from the 60-second cache). No GraphQL schema change: `buBillingStatus` returns the generic `Generic` type.

## Step 8 — Client ✅
Needs: Step 7, Your Part C.
- `store/context-slice.ts` and `constants/graphql-map.ts`: the four fields; selectors `selectJobLimitReached`, `selectWhatsappLimitReached`.
- `lib/apollo-client.ts` + `read-only-dialog.tsx`: handle `JOB_LIMIT_REACHED` like `BRANCH_LIMIT_REACHED`, then refresh billing.
- Single-job and batch-job screens: disable Save at the limit; show "Jobs this month: 42 / 75" (hidden when unlimited, amber above 90 %, never red).
- WhatsApp: Customer Connect disables Send Messages at the limit and shows "WhatsApp messages this month: 18 / 20". The other send points (intake, delivery, money receipt, invoice hooks and the EW Send action) show `MESSAGES.BILLING_WHATSAPP_LIMIT` instead of the confirm dialog at the limit, rather than each button being disabled. A response with `limitReached` shows the same message.
- New keys in `constants/messages.ts`: `BILLING_JOB_LIMIT`, `BILLING_WHATSAPP_LIMIT`.

## Step 9 — Help and verification ✅
Needs: Steps 1–8.
- `help-content.ts`: allowances per plan, what the usage line means, reset on the 1st, deleting doesn't give a job back, what to do when blocked (upgrade; manual pickup confirmation for OTP).
- `dev-help-content.ts`: one new article — `.env` keys, columns, `bu_usage`, the four SQL ids, `reserve_jobs` on the job cursor, `send_metered` and its seven call sites, the two error codes, the four stamping points, the protected lists, the migration script. Update the billing articles that list columns and refusal codes.
- Verify: limit 2 → third job refused; batch of 2 with 1 left refused whole; failed save leaves `jobs_used` unchanged; two parallel saves with 1 left → one succeeds; WhatsApp limit 1 → second send refused with no Meta call; Meta failure gives the message back; `bu_usage` not writable via `genericUpdate`; `pnpm exec tsc -b --noEmit`, `pnpm format`.
