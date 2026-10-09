# Enforce Lite plan limits

## Goal

- Make the Lite plan's promises real. A Lite business unit (BU) gets, per calendar month (India time): **100 jobs** and **20 WhatsApp messages**, with **1 user** at any time. Branches are already limited to 1, and spare-parts inventory is included, so neither needs work.
- When a limit is reached, the action is refused with a clear message that names the limit and suggests upgrading. Nothing already saved is lost or locked.
- Staff can see how much of the month's allowance is left before they run out.
- Decisions already made:
  - Limits are counted per BU, per calendar month, as `service-plus-portal/content/legal.ts` already promises.
  - **Job intake is blocked at the limit.** This reverses constraint 6 of `service-plus-portal/plans/plan.md`, which kept jobs and WhatsApp as allowances only. On a free plan the limit means nothing unless it is enforced.
  - Opening jobs (`is_opening_job`, used to bring in jobs from an old system) do not count and are never blocked.
  - Only Lite gets limits now. The limits live in one map keyed by plan, so Basic (200 / 200 / 1 user) can be switched on later by filling in its row.

## Present context and current design

- **Plan on the BU:** `security.bu` holds `plan_code`, `branch_limit`, `billing_required`, `monthly_fee_paise`, `paid_through`. Approval and plan change set them (`app/graphql/resolvers/bu_admin/signups.py`, `billing.py`).
- **Branch limit, the one enforced limit today, is the pattern to copy:**
  - Server: `app/graphql/resolvers/masters/branches.py` counts branches and refuses with code `BRANCH_LIMIT_REACHED` and the limit in `extensions`.
  - Client: `src/lib/apollo-client.ts` catches `BRANCH_LIMIT_REACHED` and `SUBSCRIPTION_READ_ONLY` and stores a `billingNotice` in `src/store/context-slice.ts`; `src/components/shared/billing/read-only-dialog.tsx` shows it.
- **BU status reaches the client** through the `buBillingStatus` query (`app/services/bu_billing.py`, cached 60 seconds), which returns `status`, `paidThrough`, `planCode`, `branchLimit`. `src/components/shared/billing/use-billing-sync.ts` keeps it in the slice and `billing-banner.tsx` shows the due-soon / view-only banner.
- **Jobs are created in two resolvers**, both guarded by `require_bu_writable` in `app/graphql/resolvers/mutation.py`:
  - `createSingleJob` → `resolve_create_single_job_helper` in `app/graphql/resolvers/jobs/mutations.py` (also used for opening jobs).
  - `createJobBatch` → `resolve_create_job_batch_helper`, one or more jobs in one transaction.
  - The `job` table in each BU schema has `created_at` and `is_opening_job`, so the month's jobs can be counted directly. No counter is needed.
- **WhatsApp messages all go out through `send_template`** in `app/whatsapp/client.py`. That function knows nothing of the BU; its callers do:
  - `app/whatsapp/sender.py`: completion (one message per customer, in chunks), job creation notice, delivery notice (a summary plus an OTP message, so two messages), money receipt, invoice.
  - `app/whatsapp/ew_sender.py`: extended-warranty lead alert (also sent from the public EW router) and reminders (several at once).
  - Each send is recorded inside the job's own data, not in one log, so there is no cheap way to count a month's messages. A small counter table is needed.
- **Users are linked to a BU** through `security.user_bu_role`, written by `createBusinessUser` (`resolve_create_business_user_helper`) and `setUserBuRole` (`resolve_set_user_bu_role_helper`, which replaces a user's whole BU list) in `app/graphql/resolvers/bu_admin/users_roles.py`. Admin users (`is_admin`) are tenant-wide and are not counted.
- **Schema changes** to existing tenant databases are applied by hand; new tenant databases get the `security` schema from `app/db/sql/sql_bu_admin_ddl.py`. Lite BUs only ever live in the default customer database.

## New design brief

- One server map of plan limits, plus a helper that answers "how much is used and how much is left this month" → Step 1.
- A monthly WhatsApp counter table in `security` → Step 2.
- Job creation refuses beyond the monthly job limit → Step 3.
- Every WhatsApp send reserves its messages first and refuses beyond the monthly limit → Step 4.
- Adding a user to a BU at its user limit is refused → Step 5.
- A usage query, and the client's handling of the three new refusals → Steps 6 and 7.
- A usage line for staff and a usage column for the approver → Step 8.
- Help articles for staff and developers → Step 9.

## Key constraints

1. **Two people creating jobs at the same moment could both pass a "99 used" check.** Resolution: job creation takes a per-BU transaction lock before counting, so the count and the insert happen one at a time for that BU. Lite has one user, so the wait is never noticeable.
2. **A WhatsApp send can fail after the message was counted.** Resolution: reserve before sending and give the reservation back when Meta refuses the message, so only accepted messages use up the allowance.
3. **Some sends are several messages at once:** completion to several customers, delivery summary plus OTP, and EW reminders. Resolution: a user-started send reserves all its messages in one go. If they do not all fit, nothing is sent and the refusal says how many are left. The scheduled EW reminders send as many as fit and skip the rest, logging each skip.
4. **A blocked delivery OTP must not strand a job at the counter.** Resolution: the delivery screen already has manual pickup confirmation (`set_job_delivery_manual_confirmation`). The WhatsApp limit refusal tells staff to use it.
5. **A message sent automatically, such as the job creation notice, can hit the limit after the job is saved.** Resolution: the job stays saved. Only the message is refused, and the dialog says so plainly.
6. **Existing Lite BUs may already be over a limit.** Resolution: jobs and WhatsApp count from the start of the current month, so everyone starts fresh. Extra users who already exist are kept; only new additions are refused.
7. **Plan changes must take effect at once.** Resolution: limits are looked up from the BU's current `plan_code` on every check, with no copy stored on the BU. Moving to Basic removes the Lite limits immediately.
8. **The portal states the same numbers in its own file.** Resolution: a comment in the server map and in `service-plus-portal/content/pricing.ts` points to the other. Serving the limits through `/api/public/plan-prices` is left for later.
9. **The counter table must exist before any Lite send.** Resolution: the WhatsApp check runs only when the plan has a WhatsApp limit, so only the default customer database needs the table now (Your Part A).

## Steps

### Step 0 — Your Part

- Nothing is needed before the build starts.

### Step 1 — Plan limits and usage helper (server)

Needs: none.

- **Explanation:**
  - Add a plan-limits map next to the price list. It has one row per plan with jobs a month, WhatsApp messages a month and users. Lite is 100 / 20 / 1; every other plan is "no limit" for now. A comment points to the portal's `content/pricing.ts`.
  - Add a small usage service with:
    - `get_plan_limits(db_name, schema)`: reads the BU's `plan_code` (reusing the cached billing read) and returns its limits.
    - `month_start_ist()`: the first day of the current month in India time, from `today_ist()`.
    - `count_jobs_this_month`, `count_whatsapp_this_month`, `count_bu_users`: one query each.
  - New error codes and texts: `JOB_LIMIT_REACHED` ("Your plan includes {limit} jobs a month. This month's jobs are used up; upgrade for more."), `WHATSAPP_LIMIT_REACHED` (says how many messages are left this month and, for delivery, to confirm pickup manually), and `USER_LIMIT_REACHED`. Each carries `limit` and `used` (and `left` for WhatsApp) in `extensions`, the same shape as `BRANCH_LIMIT_REACHED`.
  - New SQL ids: `COUNT_JOBS_SINCE` (BU schema: jobs with `created_at` on or after the month start and `is_opening_job` false), `COUNT_BU_USERS` (active, non-admin users linked to the BU through `user_bu_role`), and the counter queries of Step 2.
- **Path:** server `app/core/plan_limits.py` (new), `app/services/plan_usage.py` (new), `app/core/exceptions.py`, `app/db/sql/sql_billing.py`, `app/db/sql/sql_jobs.py`.

### Step 2 — WhatsApp counter table (server)

Needs: Step 1.

- **Explanation:**
  - New table `security.bu_usage`: BU, month (first day of the month), WhatsApp messages sent. One row per BU per month, unique on BU + month.
  - Add it to the `security` DDL so new tenant databases get it.
  - Three SQL ids:
    - `RESERVE_BU_WHATSAPP` creates the month's row if missing, then adds *n* only if the total stays within the limit. It returns the new total, or nothing when refused. Doing both in one statement makes it safe under parallel sends.
    - `RELEASE_BU_WHATSAPP` subtracts *n*, never below zero.
    - `GET_BU_WHATSAPP_THIS_MONTH` reads the count.
- **Path:** server `app/db/sql/sql_bu_admin_ddl.py`, `app/db/sql/sql_billing.py`.

### 🧑 Your Part A — after Step 2

Needs: Step 2.

- **A.** Create `security.bu_usage` in the default customer database, using the statement Step 2 adds to `sql_bu_admin_ddl.py`.

### Step 3 — Enforce the job limit (server)

Needs: Step 1.

- **Explanation:**
  - In both job-creation resolvers, after `SET search_path`:
    1. Look up the BU's job limit. If none, or the job is an opening job, skip the check.
    2. Take a per-BU transaction lock (constraint 1).
    3. Count this month's jobs.
    4. If used + new jobs (1, or the batch size) would exceed the limit, raise `JOB_LIMIT_REACHED`.
  - A batch is accepted whole or refused whole; it is never half-saved.
  - Nothing else changes, and updates to existing jobs are never limited.
- **Path:** server `app/graphql/resolvers/jobs/mutations.py` (`resolve_create_single_job_helper`, `resolve_create_job_batch_helper`).

### Step 4 — Enforce the WhatsApp limit (server)

Needs: Steps 1, 2; Your Part A.

- **Explanation:**
  - New helper `reserve_whatsapp(db_name, schema, n)`. It does nothing when the plan has no WhatsApp limit; otherwise it runs `RESERVE_BU_WHATSAPP` and raises `WHATSAPP_LIMIT_REACHED` (with what is left) when refused. A partner `release_whatsapp(db_name, schema, n)` gives messages back.
  - In each sender, reserve before any message goes out, and release for every message Meta refuses (constraint 2):
    - Completion: reserve the number of chunks (one per customer, split at 35 jobs) before sending any.
    - Creation notice, money receipt, invoice: 1.
    - Delivery notice: 2 (summary and OTP).
    - EW lead alert: 1. If refused, the lead is still saved and the alert is skipped with a log line, as a failed alert is today.
    - EW reminders: reserve one at a time and stop when refused, reporting the rest as "skipped: monthly limit" (constraint 3).
  - Status callbacks from Meta (`whatsapp_webhook_router.py`) are not touched.
- **Path:** server `app/services/plan_usage.py`, `app/whatsapp/sender.py`, `app/whatsapp/ew_sender.py`.

### Step 5 — Enforce the user limit (server)

Needs: Step 1.

- **Explanation:**
  - `createBusinessUser`: for each BU in `bu_ids` whose plan has a user limit, count its users. At the limit, raise `USER_LIMIT_REACHED` naming the BU, before anything is written.
  - `setUserBuRole`: the same check, but only for BUs the user is being newly added to, so saving an existing user's unchanged BUs never fails.
  - Sign-up approval creates the Lite Manager through `createBusinessUser` into an empty BU, so it always passes.
  - `user_bu_role` is already closed to non-admins in `genericUpdate`. Admins writing it there directly is accepted as an admin's own choice, and noted in the developer help.
- **Path:** server `app/graphql/resolvers/bu_admin/users_roles.py`.

### Step 6 — Usage query (server)

Needs: Steps 1, 2.

- **Explanation:**
  - New GraphQL query `buPlanUsage(db_name, schema)`, guarded like `buBillingStatus`. It returns, for jobs, WhatsApp and users: used, limit (null when unlimited), and the month it counts.
  - Not cached: it is read on screen load and after each job or send, not on every write.
  - For the approver, add `jobsThisMonth` and `whatsappThisMonth` to the Subscriptions list query, for Lite BUs only.
- **Path:** server schema `.graphql` file, `app/graphql/resolvers/query.py`, `app/services/plan_usage.py`, `app/db/sql/sql_billing.py`; client `src/constants/graphql-map.ts`.

### Step 7 — Show the refusals (client)

Needs: Steps 3, 4, 5.

- **Explanation:**
  - Widen `BillingNoticeType.code` in `context-slice.ts` to include `JOB_LIMIT_REACHED`, `USER_LIMIT_REACHED` and `WHATSAPP_LIMIT_REACHED`, and carry `limit` / `used` / `left`.
  - In `apollo-client.ts`, catch the three new codes the same way as `BRANCH_LIMIT_REACHED`.
  - In `read-only-dialog.tsx`, give each code its own title: "Job limit reached", "User limit reached", "WhatsApp limit reached". The body is the server message, plus a line pointing to the pricing page. The dialog uses no red (red is for errors and mandatory-field asterisks); it keeps the dialog's existing neutral and amber styling.
  - Job intake and batch intake: the form keeps what was typed, so nothing is lost if the user upgrades and retries.
  - Delivery: when the delivery notice is refused, the dialog says to use manual pickup confirmation (constraint 4).
  - Texts longer than two words go in `src/constants/messages.ts`.
- **Path:** client `src/store/context-slice.ts`, `src/lib/apollo-client.ts`, `src/components/shared/billing/read-only-dialog.tsx`, `src/constants/messages.ts`.

### Step 8 — Show usage before the limit (client)

Needs: Steps 6, 7.

- **Explanation:**
  - A small hook, `use-plan-usage.ts`, runs `buPlanUsage` on BU change and after a job is created or a WhatsApp send finishes.
  - `billing-banner.tsx`: for a BU with limits, show an amber line once any allowance is 80% used, such as "86 of 100 jobs used this month · 18 of 20 WhatsApp messages". It stays hidden below 80% and for plans without limits.
  - Job intake header: a quiet "Jobs this month: 86 / 100" next to the title, Lite only.
  - Admin → Subscriptions: "Jobs" and "WhatsApp" columns showing used / limit for Lite rows and "—" for others, so the approver can spot shops ready to upgrade.
  - The layout stays responsive: the banner wraps on phones, and the new columns hide below `md`.
- **Path:** client `src/components/shared/billing/use-plan-usage.ts` (new), `src/components/shared/billing/billing-banner.tsx`, the job intake page under `src/features/client/components/jobs/`, `src/features/admin/pages/subscriptions-page.tsx`.

### Step 9 — Help articles

Needs: Steps 3–8.

- **Explanation:**
  - `help-content.ts` (staff): one article, "Lite plan limits". It covers what counts (new jobs, not opening jobs; every WhatsApp message, with delivery counting two), when the month resets, what each refusal means, manual pickup confirmation, and how to upgrade.
  - `dev-help-content.ts` (developers): one new article covering:
    - `plan_limits.py` and the portal copy that must match it.
    - `security.bu_usage` and its reserve / release.
    - The three error codes.
    - `buPlanUsage`.
    - The per-BU job lock, the opening-job exemption and the `setUserBuRole` rule.
    - That `user_bu_role` written through `genericUpdate` by an admin is not checked.
  - Re-check the billing / branch-limit article, which lists the billing notice codes, and any article that says only branches are limited.
- **Path:** client `src/features/client/components/help/help-content.ts`, `src/features/super-admin/components/help/dev-help-content.ts`.

### 🧑 Your Part B — after Step 9

Needs: Step 9.

- **B.** On a test Lite BU, create jobs to the limit, send WhatsApp messages to the limit, and try to add a second user. Confirm each is refused with its dialog, then change the BU to Basic and confirm all three work again.

### Step 10 — Keep the plan documents in step

Needs: Step 9.

- **Explanation:**
  - In `plans/plan-workflow.md`, move jobs, WhatsApp and users from "Gaps" into Stage 8 as enforced.
  - In `service-plus-portal/plans/plan.md`, mark constraint 6 (never block job intake) and the "inventory on Lite" nudge in Step 4 as superseded by this plan.
- **Path:** `plans/plan-workflow.md`, `service-plus-portal/plans/plan.md`.
