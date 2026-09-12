# Plan — Extended Warranty UI/UX overhaul

## Goal

Rework the **Custom → Extended Warranty** module so the very first screen answers
"where does the whole funnel stand" and everything an operator does happens on the
fewest possible screens. Concretely:

1. A **Dashboard** built around the funnel **Leads → Message sent → Interested →
   Followed up → Won/Lost**, shown as a small flow graphic, with the section
   groupings asked for:
   - **Leads** — 60 days / 30 days / 7 days / 0 days / Overdue (past expiry)
   - **Message sent** — Today / This week / This month / more than a month ago
   - **Interested**, **Follow-ups**, **Won**, **Lost**
2. **Two screens total** (Dashboard + Leads) instead of the current three tabs plus
   a nested segmented control.
3. Follow-up and deal closing available on **every** lead — including leads whose
   customers never tapped "I am interested". "Close a deal" means a fast Won/Lost
   decision with minimal clicks, still writing the same `follow_ups` history.
4. A small flow graphic in the UI: **Leads → Message sent → Interested → Followed
   up → Won/Lost** (with Lost as a terminal split beside Won).

UI/UX passes: modern (cards over raw tables where it helps, subtle framer-motion
entrances, iconography, consistent status chips), responsive, and the same layout
conventions the rest of the app already uses (`reports/common/`, shadcn,
`--cl-*` tokens).

---

## Present context and current design

The module lives in `features/client/components/custom/extended-warranty/`. The
screen is `extended-warranty-section.tsx`: three tabs plus a nested control.

| Tab | Contents |
|---|---|
| **Dashboard** | 4 `KpiCard`s (Due in next 30 days · Interested · Converted · Failed to send), a `ChartCard` "Funnel by reminder stage" (bar segments per stage_status), and the Message log grid. Every card/segment drills through `EwDrilldownDialog` + `GET_EW_DRILLDOWN` |
| **Reminders** | A segmented control switching two grids (no top-level tabs beneath it): **Due to send** (`EwDueGrid` — selectable rows, grouped-by-stage sequential `sendEwReminders`) and **Interested** (`EwInterestGrid` — the only place a follow-up can start today, plus the staff-alert resend) |
| **Customers** | `EwCustomerGrid` — search/paging/Add/Edit/Delete via `EwCustomerDialog` |

Follow-up (`EwFollowUpDialog`) is **only reachable from the Interest grid** today.
`APPEND_EW_FOLLOW_UP` on the server is customer-level and already tolerates
`stage = null` (`sql_extended_warranty.py:214-258`), so the write path needs zero
server change to follow up a lead that never clicked interested — only the UI gates
it today.

Dashboard data today:
- `GET_EW_DASHBOARD_KPIS` — one row: `due_in_window` (≤30d), `not_contacted`,
  `messages_sent`, `delivered`, `failed`, `interested`, `followed_up`, `converted`,
  `not_interested`, `unreachable`, `opted_out`. No per-bucket (60/30/7/0/overdue)
  breakdown and no sent-recency (today/week/month/older) breakdown.
- `GET_EW_FUNNEL_BY_STAGE` — `stage × stage_status` counts.
- `GET_EW_DRILLDOWN` — fully optional predicates over `ew_stage_v`:
  `branch_id, date_from, date_to, stage, stage_status, delivery_status, brand_id,
  only_interested`. It has **no** days-left/bucket predicate (leads with no view
  row — never messaged — are invisible to it) and **no** lost / has-follow-up
  predicate.

Data model invariants that shape everything below:
- `ew_stage_v` is one row per **customer × stage**; a never-messaged customer has
  no rows in it (dashboard counts from `ew_customer` directly for those).
- `interest_at` / `stage_status` live **per stage**; `follow_up_count` and
  `outcome` live **on the customer**.
- `reminder_days_before` from the `extended_warranty` setting is **data**, not
  code — the stage set is currently default `[30, 7, 0]`. Anything new must keep
  deriving from it, never hard-code.
- `enabled` (the add-on's master switch) and
  `whatsapp_notifications.EXTENDED_WARRANTY` (send-allowed) are the two gates. The
  screen and bell only exist while `enabled` is on.

---

## Key constraints of present design

- **`sqlId` is a contract with the server.** New reads mean a new constant in
  `app/db/sql/sql_extended_warranty.py` *and* the exact same string in
  `constants/sql-map.ts`, shipped together — an id with no server-side entry 404s
  at runtime. The server repo is read-only reference here; this plan flags the
  server files that must change, implementation happens against the live server.
- **Stage set is data.** The dashboard's leads buckets (and the funnel) must be
  built from `reminder_days_before`, never a literal list.
- **Two lead populations behave differently.** A never-messaged lead has no
  `ew_stage_v` row (`GET_EW_DRILLDOWN` can't see it). A messaged-but-not-interested
  lead has a row **with no `interest_at`**. Both must be reachable for follow-up.
- **Red is reserved for errors** (project-wide hard rule). Lost and Not interested
  are normal business outcomes → slate, never red. Only failed delivery / failed
  alert use red.
- **`follow_up` and `stage_status` semantics differ**: follow-ups are counted at
  customer level (`follow_up_count > 0`), interest/converted/lost at
  customer × stage level. The dashboard must be explicit about which it shows.
- Client conventions: `type` not `interface`, `…Type` suffix, alphabet-sorted
  everywhere, explicit named imports (no barrels), arrow components + `function`
  declarations for handlers/utilities, react-hook-form + zod + `mode:"onChange"` +
  submit-disabled-while-invalid, debounce from `constants/timing.ts`, messages
  over two words in `constants/messages.ts`, use `useGenericQuery` /
  `apolloClient.query` (never `useApolloClient`), `useAppSelector` /
  `useAppDispatch` only, responsive, framer-motion for transitions, sonner toasts.
- **Every code change updates both help files** (`help-content.ts` client-facing,
  `dev-help-content.ts` developer-facing) in the same change.
- The staff-alert deep link `/client/custom/ew/<id>-<stage>` must keep landing on
  the specific lead with its follow-up ready, from the Leads screen.

---

## New design brief

### Two screens: Dashboard and Leads

`extended-warranty-section.tsx` keeps exactly two tabs. The nested
Due/Interested segmented control and the third Customer tab go away; their job is
taken over by the single Leads screen (below), which is the module's main working
surface. `EwReminderLogGrid` stays on the Dashboard.

### Dashboard (rebuilt)

Top to bottom:

1. **Flow graphic — `EwFunnelFlow`** (new, small, full width). Five nodes with
   counts and connecting arrows:
   `Leads → Message sent → Interested → Followed up → Won | Lost`. Counts come
   from the overview query; every node is clickable into its drill-down. Won is
   emerald, Lost is slate (not red), intermediate nodes keep their existing
   ladder colours. Subtle staggered fade/slide via framer-motion; box-drawn arrows
   (no image assets), responsive: wraps onto two rows on narrow widths.
2. **Leads distribution.** One clickable `KpiCard` per configured stage
   (`reminder_days_before`, default after this change `[60, 30, 7, 0]`) + one
   **Overdue** card (expired, within the send grace so it matches what remains
   actionable). Each tile counts **active, non-opted-out customers in `ew_customer`
   whose `days_left` falls in that bucket — messaged or not, interested or not** —
   i.e. the whole lead pool per window. Clicking a tile navigates to the **Leads**
   tab with that bucket filter already applied (drilling a lead-pool tile into the
   working list, not into a second dialog).
3. **Message sent.** Four `KpiCard`s — Today / This week / This month / More than a
   month ago — counting `sent_at`. Each opens `EwDrilldownDialog` scoped by
   `date_from/date_to` (no new drill-down predicate needed). A small inline
   **Failed to send** chip (red) sits under this section for the error case that was
   a KPI before.
4. **Outcomes.** Four compact tiles: **Interested**, **Follow-ups**, **Won**,
   **Lost**, with Won carrying the conversion sub-value. Interested/Won/Lost open
   `EwDrilldownDialog`; Follow-ups opens the same dialog filtered
   `has_follow_up = true` (new predicate, below). Lost = `NOT_INTERESTED` +
   `UNREACHABLE`.
5. **Message log** card (existing `EwReminderLogGrid`), kept beneath — it is a
   record you consult after looking at numbers, not a place you work.

### Leads screen (new main working surface)

Replaces Due + Interested + Customers. One grid of **customer-level rows** (one row
per lead, not per stage), driven by a new `GET_EW_LEADS_PAGED`, with:

- **Filters** running the table: search box (name/mobile/serial); status pills
  (All · Due to message · Message sent · Interested · Followed up · Won · Lost);
  bucket chips (60/30/7/0/Overdue), pre-selected when the Dashboard drills in;
  outcome filter.
- **Every row carries the state today's three grids split** — customer, mobile,
  device, warranty ends + days left, bucket, current `stage_status` badge, delivery
  badge of the relevant stage, interest info (preferred contact, their note),
  staff-alert badge + resend, follow-up count, and outcome.
- **Row actions:** `Follow up / Close` (every non-terminal lead — the point of this
  overhaul), `Send reminder` (only when a due stage is unclaimed; keeps the current
  grouped-by-stage sequential send), Edit, Delete, and a row-click **detail dialog**.
- **`EwLeadDetailDialog`** (new) — "more details in each screen": full contact and
  device info, warranty line, one message chip per stage (30/7/0 delivery statuses),
  the interest block (preferred contact, remarks, alert status + resend), the
  follow-up history timeline, and a `Follow up / Close` button that opens
  `EwFollowUpDialog`.
- **Add record** opens the existing `EwCustomerDialog` (keeps the cross-lookup
  prefill and the full validation).

### Follow-up / deal closing everywhere

`EwFollowUpDialog` becomes reachable from any lead, not just interested ones:

- The caller passes the lead's **last-sent stage** (from the leads row) so
  `APPEND_EW_FOLLOW_UP` advances a real stage's `stage_status`; a lead with no
  stages yet passes `null` (already supported server-side, customer-level only).
- The dialog's outcome step is reworded into plain deal language —
  **Won** (`CONVERTED`) · **Lost — not interested** (`NOT_INTERESTED`) · **Lost —
  couldn't reach** (`UNREACHABLE`) · **Still following up** (`IN_PROGRESS`) — as a
  prominent segmented choice so closing a deal is one tap, not a hunt through a
  select. Won reads emerald, Lost slate.
- The dialog gains a lead-context header (warranty end, days left, current status)
  so staff can decide without leaving the dialog.
- This is **UI-only**: the mutation payload and the server resolver are unchanged.

### Data additions (small, all via the existing `genericQuery` envelope)

| SQL id (server `sql_extended_warranty.py` + mirror in `constants/sql-map.ts`) | Purpose |
|---|---|
| `GET_EW_DASHBOARD_OVERVIEW` — new | One row feeding every dashboard section: per-bucket lead counts for the configured `stages` + overdue, message-sent counts for today/week/month/older, `interested`, `followed_up` (distinct customers, `follow_up_count > 0`), `won`, `lost`, `failed`. Params: `branch_id`, `stages int[]`, `grace_days` |
| `GET_EW_LEADS_PAGED` — new | Customer-level leads grid: one row per customer with a "current" stage lateral (interest-bearing stage if any, else the latest sent stage) exposing `stage, stage_status, delivery_status, sent_at, interest_at, preferred_contact, customer_remarks, alert_status, alert_error`, alongside existing customer columns. Filters: `branch_id`, `search`, bucket bounds (`days_left_min/max`), `status` (due / messaged / interested / followed-up / won / lost), `outcome`, paging |
| `GET_EW_DRILLDOWN` — extended | New optional predicates: `lost bool` (outcome in NOT_INTERESTED/UNREACHABLE) and `has_follow_up bool` (join `ew_customer`, `follow_up_count > 0`). Message-recency rows need no new predicate — the client supplies `date_from/date_to` |

No new GraphQL mutations, no new resolvers. The daily default stage set becomes
`[60, 30, 7, 0]` (settings seed + `_EW_DEFAULT_SETTINGS` + delta script + live
`demo1` row updated once; the client `DEFAULT_STAGES` fallback follows).

---

## Files touched

**Server** (sibling repo, read-only here — flagged so the client change ships with it):
- `app/db/sql/sql_extended_warranty.py` — add `GET_EW_DASHBOARD_OVERVIEW`,
  `GET_EW_LEADS_PAGED`; extend `GET_EW_DRILLDOWN` with `lost` and `has_follow_up`.
- `app/whatsapp/sender.py` — `_EW_DEFAULT_SETTINGS` `reminder_days_before` →
  `[60, 30, 7, 0]`; `app/db/seeds/seed_bu_data.py` + `scripts/ew_delta.sql`
  (default in the JSON literal) to match; one-off update of the live `demo1` row.

**Client — constants / types:**
- `constants/sql-map.ts` — three mirror entries.
- `features/client/types/extended-warranty.ts` — add `EwDashboardOverviewType`,
  `EwLeadsRowType`; adjust `EwDrilldownFilterType` (in the dialog file).
- `constants/messages.ts` — new strings (all over two words).

**Client — `custom/extended-warranty/`:**
- `extended-warranty-section.tsx` — two tabs (Dashboard / Leads); deep-link navState
  now opens **Leads** with the Interested filter and that lead's follow-up dialog;
  keeps the `whatsappDeliveryStatus` subscription and refresh-key bumping.
- `ew-dashboard.tsx` — rebuilt per the sections above; keeps the `EwDrilldownDialog`
  and message log.
- `ew-funnel-flow.tsx` — **new** flow graphic.
- `ew-leads-screen.tsx` — **new**; replaces `ew-due-grid.tsx`,
  `ew-interest-grid.tsx`, `ew-customer-grid.tsx` (deleted).
- `ew-lead-detail-dialog.tsx` — **new** detail dialog.
- `ew-follow-up-dialog.tsx` — reworded outcome choices, lead-context header,
  `stage` from the caller (may be `null`); accepts non-interested leads.
- `send-ew-reminders.ts` — unchanged pay paths; the leads screen reuses
  `sendEwReminders` / `addEwFollowUp` / `resendEwLeadAlert`.
- `extended-warranty-helpers.ts` — bucket helpers (config-driven bounds + overdue),
  status → filter pills mapping.
- Deleted: `ew-due-grid.tsx`, `ew-interest-grid.tsx`, `ew-customer-grid.tsx`.

**Client — help (both files, same change):**
- `features/client/components/help/help-content.ts` — dashboard sections, the two
  screens, follow-up available on every lead, closing = Won/Lost from the follow-up
  dialog, the flow graphic, 60-day bucket, "add from the Leads screen".
- `features/super-admin/components/help/dev-help-content.ts` — the two new SQL ids,
  `GET_EW_DRILLDOWN`'s new predicates, three-tab → two-tab consolidation, leads-row
  semantics (customer-level "current" stage lateral), `lost`/`followed_up` count
  semantics, default stages `[60, 30, 7, 0]`.

No router / menu / access-right / settings-dialog changes — the module's shell and
entry points are untouched.

---

## Implementation

### Step 1 — Server: SQL store + defaults (server repo; coordinate before client ships)

1. In `app/db/sql/sql_extended_warranty.py`:
   - **`GET_EW_DASHBOARD_OVERVIEW`** — base lead-pool counts from `ew_customer`
     (active, not opted out, branch-scoped): a `VALUES`/`unnest` over
     `%(stages)s::int[]` classifies each customer into the tightest bucket
     (`MAX(stage)` reached), produces `leads_60/30/7/0` style per-bucket keys plus
     `leads_overdue` for `days_left < 0 AND >= grace_days`. Message-recency from
     `ew_stage_v` (`sent_at` vs `date_trunc('day')`, `date_trunc('week')`,
     `date_trunc('month')`, older). `interested` = `interest_at IS NOT NULL`;
     `followed_up` = distinct customers with `follow_up_count > 0` (subquery);
     `won` = `stage_status = 'CONVERTED'`; `lost` = `stage_status IN
     ('NOT_INTERESTED','UNREACHABLE')`; `failed` = `delivery_status = 'FAILED'`.
     All branches pass `branch_id`.
   - **`GET_EW_LEADS_PAGED`** — `FROM ew_customer c` with the brand/product joins,
     a lateral `LATERAL` choosing the "current" stage object (`interest_at` stage
     first, else the sent stage with greatest `stage`), exposing the per-lead
     status fields, plus `days_left`, `follow_up_count`, `interest_count`,
     `outcome`, `is_opted_out`, `total_count`. Filter block:
     `bucket` via `days_left_min/days_left_max`, `status` (mapped to
     `stage_status`/`interest_at`/`follow_up_count` predicates plus a "due" branch
     reusing the `GET_EW_DUE_CUSTOMERS` lateral), search ILIKE, `outcome`,
     `is_opted_out` excluded, paging.
   - **`GET_EW_DRILLDOWN`** — add
     `AND (%(lost)s::boolean IS NOT TRUE OR v.outcome IN ('NOT_INTERESTED',
     'UNREACHABLE'))` and a `JOIN ew_customer c ON c.id = v.ew_customer_id` with
     `AND (%(has_follow_up)s::boolean IS NOT TRUE OR c.follow_up_count > 0)`.
2. Default stages → `[60, 30, 7, 0]` in `_EW_DEFAULT_SETTINGS` (`sender.py`), the
   seed tuple (`seed_bu_data.py`), `scripts/ew_delta.sql`'s JSON literal, and the
   live `demo1` `extended_warranty` row (one-off update; the settings dialog is the
   path for other tenants).
3. Verify: `python -c "import app.main"` in the server venv; run a sandbox BU
   schema through the new queries and sanity-check a couple of counts by hand.

### Step 2 — Client: constants and types

1. `constants/sql-map.ts` — add `GET_EW_DASHBOARD_OVERVIEW`, `GET_EW_LEADS_PAGED`;
   leave existing ids untouched.
2. `features/client/types/extended-warranty.ts` —
   `EwDashboardOverviewType` (per-bucket keys, sent-today/week/month/older,
   interested, followed_up, won, lost, failed), `EwLeadsRowType` (the new grid's
   row shape). Keep `EwStageStatusType` / `EwOutcomeType` (add nothing — `lost` is
   a UI grouping, not a stored value).
3. `constants/messages.ts` — strings for the new section titles, empty states,
   filter labels (only the over-two-word ones; control labels stay hardcoded).

### Step 3 — Dashboard rebuild

1. `ew-dashboard.tsx`:
   - Drop the four KPI cards; load `GET_EW_DASHBOARD_OVERVIEW` and
     `GET_EW_FUNNEL_BY_STAGE`.
   - `EwFunnelFlow` on top (Step 4).
   - Leads tiles: `stages.map` → `KpiCard`, label from `stageLabel(stage)`
     (extended for 60/30/7/0) + an Overdue card. Values from the overview row;
     `onClick` → a new prop/`openLeads(bucket)` call that sets the section's Leads
     filter state (lifted to `extended-warranty-section.tsx` — the Dashboard gets a
     `onOpenLeads(bucket)` callback).
   - Message-sent tiles → `EwDrilldownDialog` with computed `date_from/date_to`;
     failed-send chip under the group.
   - Outcomes row: Interested (`only_interested`), Follow-ups
     (`has_follow_up: true`), Won (`stage_status: 'CONVERTED'`), Lost
     (`lost: true`), Won's `subValue` = conversion %.
   - Keep `EwReminderLogGrid` + `EwDrilldownDialog`.
2. `EwDrilldownFilterType` gains `has_follow_up?: boolean | null; lost?: boolean |
   null;` and the dialog passes them through to `GET_EW_DRILLDOWN`.

### Step 4 — Flow graphic

`ew-funnel-flow.tsx`: horizontal flex of five node chips with `ArrowRight`
connectors. Node data (label, count, colour, drill args) from the overview row +
funnel data. Click handlers: Leads → `onOpenLeads(null/overview)`, Message sent →
drilldown (all), Interested → `only_interested`, Followed up → `has_follow_up`,
Won → CONVERTED, Lost → `lost`. framer-motion staggered entry; responsive wrap;
`role="button"`/tabIndex on nodes (same pattern as `KpiCard`).

### Step 5 — Leads screen

1. `ew-leads-screen.tsx`:
   - State: search (debounced, `SEARCH_DEBOUNCE_MS`), status filter, bucket filter
     (accepts an initial value from Dashboard / deep link), outcome, page,
     selection set for sending, `detail` row, `followUp` state.
   - `GET_EW_LEADS_PAGED` with the bucket bounds + status mapping resolved in the
     page (reusing helper functions); send action groups the selected **due** rows
     by stage and calls `sendEwReminders` sequentially exactly as `EwDueGrid`
     today; toasts per result class.
   - Row layout around the current-status badge + delivery badge + alert badge +
     follow-up count; actions `Follow up / Close` (all non-terminal rows — enable
     won/lost closure on messaged-without-interest rows), `Send` (due rows),
     Edit/Delete reusing `EwCustomerDialog` and the delete `AlertDialog`.
   - Status pill definitions reuse `EW_STAGE_STATUS_LABEL` + a `DUE` pseudo-status
     labelled "Due to message". Bucket chips built from `stages` + "Overdue".
2. `ew-lead-detail-dialog.tsx`: `Dialog` (max-w-3xl) with contact/device section,
   per-stage message chips, interest block, `follow_ups` timeline (from
   `GET_EW_FOLLOW_UPS`), and the Follow up / Close button opening `EwFollowUpDialog`.
3. Delete `ew-due-grid.tsx`, `ew-interest-grid.tsx`, `ew-customer-grid.tsx` and
   their import sites.

### Step 6 — Follow-up dialog

`ew-follow-up-dialog.tsx`:
- Props gain `currentStatus?: { stage: number | null; stage_status: EwStageStatusType }`
  (or just `stage` from the caller keeps working with `null`).
- Outcome control becomes a segmented day-choice: **Won the deal** / **Lost — not
  interested** / **Lost — couldn't reach** / **Still following up**, mapping to
  `CONVERTED` / `NOT_INTERESTED` / `UNREACHABLE` / `IN_PROGRESS` (labels in
  `EW_OUTCOME_LABEL`-adjacent maps). Won emerald accent, Lost slate.
- Lead-context header lines (warranty end, days left, current badge). Everything
  else (history timeline, remarks, reset-on-open) unchanged.

### Step 7 — Section shell

`extended-warranty-section.tsx`: two tabs (Dashboard / Leads). Lift `leadsFilter`
state (bucket + status) so Dashboard tiles and the deep link can set it. Deep link
(`navState.ewCustomerId`) opens **Leads** with the Interested filter active and
that lead's detail/follow-up dialog open (replacing the old Reminders-Interested
route). Keep the `whatsappDeliveryStatus` subscription (`kind === "EW"`,
missing-`kind` ⇒ `"JOB"`) bumping both dashboard and leads.

### Step 8 — Help (both files in the same change)

- `help-content.ts`: rewrite the Extended Warranty walk-through around the two
  screens — Dashboard sections and the flow graphic; Leads = one list for due,
  messaged, interested, won and lost; a lead does not need to tap "Interested" to
  be followed up; closing a deal (Won/Lost) happens in the follow-up dialog; the
  60/30/7/0 buckets come from the settings.
- `dev-help-content.ts`: document `GET_EW_DASHBOARD_OVERVIEW`,
  `GET_EW_LEADS_PAGED`, the `GET_EW_DRILLDOWN` additions, customer-level leads-row
  semantics (current-stage lateral), `followed_up` = distinct customers vs the
  customer × stage `interest`/`won`/`lost` counts, default `reminder_days_before`
  `[60, 30, 7, 0]`, and the deleted files/tab consolidation so nothing drifts.

### Step 9 — Verification

1. Server: `python -c "import app.main"` (schema builds, imports resolve).
2. Client: `pnpm exec tsc -b --noEmit`, `pnpm build`, `pnpm format` on touched
   files. (`pnpm lint` is broken repo-wide on TS 7 — not a signal.)
3. Feature checks (manual, `demo1`):
   - Overview counts match a hand COUNT over `ew_customer`/`ew_stage_v`, per branch.
   - Every dashboard tile opens what it claims: lead buckets → Leads filtered to the
     bucket (including never-messaged leads); message-sent buckets → drilldown
     scoped by date; Interested/Follow-ups/Won/Lost → drilldown rows consistent
     with the card numbers.
   - Follow up a messaged-but-never-interested lead from the Leads row → recorded,
     `follow_up_count` incremented, `stage_status` advanced on the sent stage.
   - Close the same lead Won (and a second lead Lost) → dashboard Won/Lost move.
   - Send flow still groups by stage and honours the daily cap.
   - Deep link `/client/custom/ew/<id>-<stage>` → Leads + that lead's follow-up
     dialog; logged-out lands on login and returns after.
   - Live subscription still refreshes dashboard and leads on a status push.

---

## Testing

(No unit tests in the client package; verification is lint/build plus the manual
matrix above.)

1. Query contract — new sql-map ids return rows for `demo1` under both empty and
   filtered args; `GET_EW_DRILLDOWN` with the two new predicates returns expected
   subsets and unchanged rows when the predicates are null.
2. Bucket classification — boundary cases: exactly 0 days (today), exactly 7/30/60
   days (falls in the tile of that name — define `>= lower && <= higher`), 5 days
   past expiry (Overdue, grace respects `-7`), 90 days out (outside every bucket).
3. Leads screen — search, every status pill, bucket chips, paging; row actions on a
   never-contacted lead (no Send, follow-up available, `stage = null`); opt-out
   badge; invalid-mobile row shown but not selectable for send.
4. Regression — add/edit/delete still write through `genericUpdate`; the daily-cap
   toast, `INFO_EW_DISABLED` when the send gate is off, alert-resend from the
   detail dialog all survive.
5. Responsive — Dashboard sections wrap on narrow widths; Leads table scrolls in
   its own container; flow graphic reflows.

---

## Flags and constraints

- **Leads bucket counts include never-messaged customers** — they come from
  `ew_customer`, not `ew_stage_v`, and the Overdue tile is bounded by `_EW_GRACE_DAYS`
  (`-7`) so "Overdue" stays the set that will actually still be pursued. An
  all-time expired count would be a separate, explicitly-labelled figure.
- **The 60-day bucket is conditional on the setting.** Stages remain data: a
  tenant whose `reminder_days_before` omits 60 shows no 60 tile. The default and
  seed move to `[60, 30, 7, 0]`, and `demo1`'s live row is updated; other tenants
  add 60 via the settings dialog. Nothing in the code may hard-code the list.
- **Count semantics are deliberately split** (and must be documented in the help):
  `followed_up` = distinct customers ever followed up; `interested` / `won` /
  `lost` = customer × stage rows, matching the existing funnel ladder. A customer
  interested on two stages still counts twice for Inter-interest, exactly as today.
- **Red never denotes Lost.** Lost and Not interested render slate; only FAILED
  delivery / FAILED alert use red (hard rule).
- **`sqlId` deployment order.** The two new ids and the drilldown predicates must
  reach the server before/with the client build that references them — a lagging
  server 404s the dashboard and leads grid.
- **Follow-up on a stage-less lead is customer-level only** — `APPEND_EW_FOLLOW_UP`
  already no-ops the `stage_status` advance when `stage IS NULL`; pass the last-sent
  stage whenever one exists so the ladder actually moves.
- **The dashboard-to-Leads drill is navigation, not a dialog** — the lead-bucket
  tiles switch the active tab; the stage-based tiles use `EwDrilldownDialog`. Two
  drill surfaces, deliberately, because a never-messaged lead has no drilldown row.
- Existing deep-link contract (`/client/custom/ew/<id>-<stage>`) and the
  `EW`/`JOB` `kind` defaulting on the subscription are preserved verbatim.