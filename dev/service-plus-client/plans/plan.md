# Plan — "Getting started" checklist for a new Manager

Source: chat request, 15 Oct 2026. Built 15 Oct 2026 (Steps 1–7 ✅). (The previous plan in this file, per-BU features, is in git at commit 8d87d82.)

## Goal

A Manager who signs in to a brand-new business unit is guided, inside the app, from an empty workshop to their first delivered job. They see what to do next, can jump straight to the right screen, and can open the help for each step.

Decisions:
- **A checklist, not a click-by-click tour.** Tours pin bubbles to screen elements and break when screens change. A checklist lists the steps in order and leaves the work on the real screens.
- **It ticks itself.** Each step is done when the data shows it (for example, a delivered job exists). Nobody ticks anything by hand, so it never drifts from reality.
- **A pill in the top bar opens it**, showing progress such as "Getting started 2/6". It opens a panel; it is not a card on the job screen. The Manager lands on Jobs → Single Job, the new-job form, and a card there would get in the way of entering jobs.
- **It opens by itself once.** The first time a Manager or Admin enters a BU that has not finished it, the panel opens automatically.
- **It goes away when done.** After the first delivered job it shows a short "You're all set" and then disappears. It can also be hidden by hand.
- **Only Managers and Admins see it.** Receptionists and Technicians do not set up masters. The live demo never shows it.
- **Only the real work is listed.** A new BU already has its branch, division, numbering, job types and statuses, lookups, states and financial year, so none of those are steps.
- **No live-demo link inside the app.** Opening `/demo` signs the browser in as the demo user, which would replace the Manager's own session.

## Present context

- **Where the Manager lands.** `/client` opens Jobs with "Single Job" selected (`SECTION_DEFAULTS` in `client-layout.tsx`).
- **Opening a screen by name.** `navigate(ROUTES.client.<section>, { state: { subItem: "<menu label>" } })` opens a section with a menu item selected. `client-layout.tsx` reads `navState.subItem`, and `client-top-nav.tsx` already uses this for its shortcuts.
- **Opening a help article.** `useHelp().openHelp(articleId)` from `client-layout.tsx`. Articles that exist: `brands-models`, `technicians`, `create-job`, `job-control`, `finalize-job`, `deliver-job`, `first-time-setup`.
- **The job form adds a customer and a model on the spot.** It has "Add new customer" (`customer-select.tsx` → `AddCustomerDialog`) and `AddModelDialog`. A model needs an existing brand and product, so brands and products must come first. Technicians are only added in Masters.
- **What a job records.** In the `job` table (BU schema), `technician_id` is set once a technician is assigned, `is_final` once the job is finalized, and `delivery_date` once it is delivered. `is_opening_job` marks opening jobs, which must not count. The master tables are `brand`, `product` and `technician`.
- **The existing help article is out of date.** "First-Time Setup Checklist" (`first-time-setup` in `help-content.ts`) tells a Manager to create a branch, a division, numbering, App Settings and lookup values. A sign-up BU already has all of these (`seed_bu_data.py`). It also says a customer must exist before the job, which is no longer true.
- **Who is who.** A Manager is `user.userType === "B" && user.roleCode === "MANAGER"`, as in `use-can-manage-staff-users.ts`. An Admin is `userType === "A"`. The live demo is `user.isDemo`.
- **UI parts.** `components/ui/popover.tsx` exists; there is no Sheet component. Reads go through `useGenericQuery`.

## New design brief

- One read of the BU's progress, `GET_GETTING_STARTED_PROGRESS` (Step 1).
- The six steps, defined in one place on the client (Step 2).
- A hook that reads the progress and decides whether the checklist shows (Step 3).
- The top-bar pill and its panel (Step 4).
- The help article brought up to date, and a pointer in the welcome email (Step 5, Step 6).

The six steps:
1. Add brands and products.
2. Add a technician.
3. Create your first job (the customer and model can be added from the job form).
4. Assign a technician.
5. Finalize the job.
6. Deliver the job.

## Key constraints

1. **It must stay correct without anyone ticking boxes.** Resolution: every step's "done" comes from one server read of real data (Step 1). It is re-read when the panel opens, on window focus and on BU change (Step 3).
2. **Opening jobs must not count.** A Manager who imports old jobs as opening jobs has not created or delivered a job in Service+. Resolution: every job check excludes `is_opening_job` (Step 1).
3. **It must not get in the way.** Resolution: it lives behind a pill (Step 4). It auto-opens only once per user per BU, and hiding it is remembered (Step 3). It disappears after the first delivery.
4. **"Hidden" and "auto-opened once" are conveniences, not data.** They are kept in the browser's localStorage, keyed by database, BU and user, with every read and write wrapped in try/catch. If storage is unavailable the checklist still works: it just auto-opens again. Resolution: Step 3.
5. **Steps must name screens exactly as the menu does.** `subItem` is matched against the menu label, so a renamed menu item would silently break "Go there". Resolution: Step 2 keeps every target next to its step, and Step 7 clicks every "Go there".
6. **Read-only BUs and the demo.** A BU that is view-only for an unpaid month can't do the steps, and the demo is read-only. Resolution: hidden for the demo (`isDemo`). For a read-only BU the panel still shows; the steps wait until payment, which the billing banner already explains.

## Steps

### Step 0 — Your Part

None.

### Step 1 — Progress read (server) ✅

Needs: —

- **Explanation:** one row of yes/no answers for the current BU. It runs in the BU schema and names only BU tables, so business users may run it (it is not in `ADMIN_ONLY_SQL_IDS`).
- **Path:** `service-plus-server/app/db/sql/sql_jobs.py` (on `JobsSql`, part of `SqlStore`)
- **Code:**

```python
# "Getting started" checklist (plans/plan.md): one row of yes/no per step for the current BU.
# Opening jobs never count.
GET_GETTING_STARTED_PROGRESS = """
    with "dummy" as (values(1::int))
    SELECT
        EXISTS (SELECT 1 FROM brand) AND EXISTS (SELECT 1 FROM product) AS has_brands_products,
        EXISTS (SELECT 1 FROM technician) AS has_technician,
        EXISTS (SELECT 1 FROM job WHERE NOT is_opening_job) AS has_job,
        EXISTS (SELECT 1 FROM job WHERE NOT is_opening_job AND technician_id IS NOT NULL) AS has_assigned_job,
        EXISTS (SELECT 1 FROM job WHERE NOT is_opening_job AND is_final) AS has_final_job,
        EXISTS (SELECT 1 FROM job WHERE NOT is_opening_job AND delivery_date IS NOT NULL) AS has_delivered_job
"""
```

- **Path:** `src/constants/sql-map.ts`: add `GET_GETTING_STARTED_PROGRESS`.

### Step 2 — The six steps (client) ✅

Needs: Step 1

- **Explanation:** the single list the panel renders. Each step has its label, a one-line hint, how to tell it is done, where "Go there" leads, and which help article "Show me" opens.
- **Path:** `src/features/client/components/getting-started/getting-started-steps.ts` (new)
- **Code:**

```ts
export type GettingStartedProgressType = {
	has_assigned_job: boolean;
	has_brands_products: boolean;
	has_delivered_job: boolean;
	has_final_job: boolean;
	has_job: boolean;
	has_technician: boolean;
};

export type GettingStartedStepType = {
	done: (p: GettingStartedProgressType) => boolean;
	helpArticleId: string;
	hint: string;
	id: string;
	label: string;
	target: { route: string; subItem: string };
};

export const GETTING_STARTED_STEPS: GettingStartedStepType[] = [
	{ done: (p) => p.has_brands_products, helpArticleId: "brands-models", hint: MESSAGES.GS_HINT_BRANDS,
	  id: "brands", label: "Add brands and products", target: { route: ROUTES.client.masters, subItem: "Brand" } },
	{ done: (p) => p.has_technician, helpArticleId: "technicians", hint: MESSAGES.GS_HINT_TECHNICIAN,
	  id: "technician", label: "Add a technician", target: { route: ROUTES.client.masters, subItem: "Technician" } },
	{ done: (p) => p.has_job, helpArticleId: "create-job", hint: MESSAGES.GS_HINT_JOB,
	  id: "job", label: "Create your first job", target: { route: ROUTES.client.jobs, subItem: "Single Job" } },
	{ done: (p) => p.has_assigned_job, helpArticleId: "job-control", hint: MESSAGES.GS_HINT_ASSIGN,
	  id: "assign", label: "Assign a technician", target: { route: ROUTES.client.jobs, subItem: "Job Control" } },
	{ done: (p) => p.has_final_job, helpArticleId: "finalize-job", hint: MESSAGES.GS_HINT_FINALIZE,
	  id: "finalize", label: "Finalize the job", target: { route: ROUTES.client.jobs, subItem: "Final a Job" } },
	{ done: (p) => p.has_delivered_job, helpArticleId: "deliver-job", hint: MESSAGES.GS_HINT_DELIVER,
	  id: "deliver", label: "Deliver the job", target: { route: ROUTES.client.jobs, subItem: "Deliver Job" } },
];
```

- **Path:** `src/constants/messages.ts`, new keys:
    - `GS_HINT_BRANDS`: "The makers and device types you repair, e.g. Samsung and Mobile. Models can be added later from the job form."
    - `GS_HINT_TECHNICIAN`: "Who repairs the devices. Jobs are assigned to a technician."
    - `GS_HINT_JOB`: "Book in a device. You can add the customer and the model right from the job form."
    - `GS_HINT_ASSIGN`: "In Job Control, give the job to a technician and update its status as work goes on."
    - `GS_HINT_FINALIZE`: "Add the parts and charges, and fix what the customer pays."
    - `GS_HINT_DELIVER`: "Hand the device back: print the invoice and take the payment."
    - `GS_INTRO`: "Six steps from an empty workshop to your first delivered job."
    - `GS_ALL_DONE`: "You're all set — your first job is delivered."

### Step 3 — `useGettingStarted` hook (client) ✅

Needs: Step 2

- **Path:** `src/features/client/components/getting-started/use-getting-started.ts` (new)
- **Explanation:** reads `GET_GETTING_STARTED_PROGRESS` with `useGenericQuery` for the current `dbName` and `schema`. It refetches when the panel opens, on window focus and on BU change. It returns:
    - `steps`: each step with its `done` flag;
    - `doneCount` and `total`;
    - `nextStep`: the first step not done;
    - `visible`: true only when the user is a Manager or Admin, is not a demo session, the progress has loaded, and the checklist is not hidden. When all six are done it stays visible once more, showing the "all set" state, and then hides itself;
    - `autoOpen`: true the first time per user per BU;
    - `hide()`, which remembers the choice.
- localStorage keys: `gs-seen:<db>:<bu>:<userId>` and `gs-done:<db>:<bu>:<userId>`, every read and write wrapped in try/catch (constraint 4). (Revised 16 Oct 2026: no `gs-hidden`; see As built.)

### Step 4 — Top-bar pill and panel (client) ✅

Needs: Step 3

- **Path:** `src/features/client/components/getting-started/getting-started-pill.tsx` (new), placed in `client-top-nav.tsx` before the help and user controls.
- **Pill:** a small rounded button labelled "Getting started", with a "2/6" badge. On narrow screens it shows only the icon and the badge.
- **Panel:** a `Popover` about 24rem wide (full width on phones) holding:
    - a header with the title, `GS_INTRO` and a progress bar;
    - the six steps in order:
        - a done step shows a green tick and a muted label;
        - the next step is highlighted and expanded, showing its hint, a **Go there** button (`navigate(step.target.route, { state: { subItem: step.target.subItem } })`, which also closes the panel) and a **Show me** link (`openHelp(step.helpArticleId)`);
        - later steps are collapsed and can be expanded;
    - a footer with "Close" (revised 16 Oct 2026: it was "Hide checklist"). When everything is done, `GS_ALL_DONE` with a check mark replaces the list.
- **Auto-open:** if `autoOpen`, the panel opens once on mount and the "seen" flag is set.
- **Look:** uses the client theme variables (`--cl-*`), so light and dark both work. Ticks are green; nothing is red. It must work at phone width.

### Step 5 — Bring the help article up to date (client) ✅

Needs: Step 2

- **Path:** `src/features/client/components/help/help-content.ts`, article `first-time-setup`.
- **Explanation:** retitle it "Getting started: your first job". Lead with "use the Getting started checklist in the top bar" and the six steps in Step 2's order and wording. Then a short "Already set up for you" list: branch, division, numbering, job types and statuses, lookups, states, financial year. Then "When you're ready": parts and opening stock, GST (division GSTIN, App Settings), WhatsApp, staff users. Fix the FAQ that says a customer must be created before the job (it can be added from the job form), and keep the FAQs that still hold.

### Step 6 — Welcome email pointer (server) ✅

Needs: Step 4

- **Path:** `service-plus-server/app/core/exceptions.py` (`EMAIL_SIGNUP_USER_LINK_BODY`)
- **Code:** add before "Welcome aboard":

```
"After you sign in, open \"Getting started\" at the top of the screen. It walks you through "
"your first job, from adding your brands to delivering the device.\n\n"
```

- Update `tests/core/test_signup_account_email.py` to check the line is there.

### Step 7 — Developer help and verify ✅

Needs: Steps 1–6

- **Developer help:** one new article in `dev-help-content.ts`, "Getting started checklist". It covers:
    - the SQL id and its six flags, with opening jobs excluded;
    - `GETTING_STARTED_STEPS` as the only list;
    - menu labels used as `subItem` (constraint 5);
    - the localStorage keys;
    - who sees it.
- **Checks:**
    - `pnpm exec tsc -b --noEmit`, `pnpm format` on the touched files, and server `pytest`.
    - On a fresh sign-up BU: sign in as its Manager. The panel opens by itself, showing 0/6, with "Add brands and products" highlighted.
    - Do each step and come back: each one ticks without a reload.
    - Every "Go there" opens the right screen, and every "Show me" the right article.
    - After the first delivery: "You're all set", then the pill is gone.
    - A Receptionist and the live demo never see it.
    - "Close" leaves the pill in place, and the panel opens again at the next login.
- Run `graphify update .` if a graph exists.

## As built

- **Group as well as screen.** Each step's target also carries `subGroup` (the menu group, e.g. "Product & Parts"). `client-layout.tsx` uses it to expand the collapsed group and set the title, so "Go there" shows the Brand item, which sits in a group that starts closed.
- **Established BUs never see it.** A BU that is already all done before this browser ever saw the checklist never shows it. The "all set" message is only for someone who worked through the steps (`gs-seen` must be set). Capital Electronics and the demo read all done, so neither sees it.
- **Checked:**
    - The server read works on the live databases: `service_001` all false, `capitalelectronics` and `servicedemo` all true. It is not admin-only.
    - The real pill and panel, on a temporary preview page with a fake Manager:
        - it opens by itself at 2/6 with step 3 highlighted;
        - a Receptionist sees no pill, and neither does a BU that is already all done;
        - phone width and dark mode look right;
        - the "You're all set" state shows.
    - `tsc -b`, the client build and 398 server tests pass.
    - Not yet done: clicking through on a real sign-up BU. That needs SP-BVK99BXL approved, which creates its Manager.

- **Revised 16 Oct 2026, after trying it:**
    - **No permanent hide.** "Hide checklist" read as "close", and it removed the pill for good. The footer is now **Close**, and the pill stays until the first delivery; an old `gs-hidden` key is ignored.
    - **Opens at every login.** The panel opens by itself once per login (or page reload) per BU until all six steps are done, instead of once ever. This is tracked in memory on the session's user object.

## Later, if wanted

- **Optional steps after the first delivery:** parts and opening stock, GST settings, WhatsApp, staff users.
- **Server-side "hidden" flag** in `app_setting`, if hiding should follow the Manager across devices.
- **Short screen videos** linked from each step's "Show me".

---

## Addition — A user with several business units (16 Oct 2026)

Source: chat request, 16 Oct 2026. Plan only; nothing is built yet. Steps use the prefix S so they cannot be confused with Steps 1–7 above.

### Goal

A Manager or Admin who looks after several business units is guided through each one that still needs setting up, without the checklist getting in the way as they move between them.

Decisions:
- **Still one checklist per BU.** Every BU has its own brands, products, technicians and jobs, so a step done in one BU is not done in another.
- **The panel says which BU it is about**, and lists the user's other BUs that still need setting up, each with a **Switch** button.
- **It opens by itself once per login, not once per BU.** Moving between BUs does not pop it up again.
- **The pill stays while any of the user's BUs is unfinished.** If the current BU is done but another is not, the pill shows a tick and the panel points to the others.
- **Finished BUs are not listed.** Established BUs never appear, as before.

### Present context (as built today)

- **Already per BU.** `useGettingStarted` reads `GET_GETTING_STARTED_PROGRESS` for the current schema only, re-reading when the BU changes. Its flags are keyed `<db>:<schema>:<user>`.
- **Pops up on every BU.** `openedInLogin` is keyed by BU, so a user who switches to three unfinished BUs gets the panel three times in one login.
- **The panel never names the BU** it is about.
- **Other BUs are invisible.** A user whose current BU is done never sees the pill, even if another of their BUs is untouched. A user on an unfinished BU doesn't learn about the others.
- **Where the BU list comes from.** `availableBus` in Redux (`selectAvailableBus`) holds every BU the user can open: from login for business users, and from `GET_ALL_BUS_WITH_SCHEMA_STATUS` for Admins, with `schema_exists`. Switching BU is `handleBuChange(buId)` in `use-bu-branch-division-actions.ts`.
- **The server already allows a multi-BU read.** `genericBatchQuery` checks each item's own `schema` with `require_bu_access` and its sqlId with `require_sql_id_access` (`shared/generic_query.py`). One batch can therefore read `GET_GETTING_STARTED_PROGRESS` for every BU the user may open, and a BU they may not open rejects the call.

### New design brief

- One batch read of the progress of every BU the user can open (S1).
- Auto-open once per login instead of once per BU (S2).
- The panel names the current BU and lists the other unfinished BUs with **Switch** (S3).
- The pill's visibility and badge take all the user's BUs into account (S4).
- Help and checks (S5).

### Key constraints

1. **Many BUs must not mean many requests.** Resolution: one `genericBatchQuery` with one item per BU (S1), capped at 25 BUs, which is more than any plan includes.
2. **Only BUs the user can open.** A batch item for a BU outside the token's list fails the whole call. Resolution: the items come only from `availableBus`, skipping BUs without a schema (`schema_exists === false`) or inactive ones (S1).
3. **Switching must keep the user's place.** Resolution: **Switch** calls the same `handleBuChange` the BU switcher uses, so branch and division are resolved exactly as when switching by hand. The panel then shows the new BU's steps (S3).
4. **No server change.** Resolution: the read reuses `GET_GETTING_STARTED_PROGRESS` through the existing batch call.

### Step S0 — Your Part

None.

### Step S1 — Progress of every BU in one read

Needs: —

- **Path:** `src/features/client/components/getting-started/use-getting-started.ts`
- **Explanation:**
    - Build one `genericBatchQuery` from `availableBus`: active BUs with a schema, at most 25. Each item is `graphQlUtils.buildGenericBatchItem({ schema: bu.code.toLowerCase(), sqlId: SQL_MAP.GET_GETTING_STARTED_PROGRESS })`.
    - Read it with `apolloClient.query` (`fetchPolicy: "network-only"`), at the same moments as today: BU change, panel open and window focus.
    - The hook returns the current BU's steps as now, plus `others: { buId, code, name, doneCount, allDone }[]` for every other BU that is not all done.
    - If the batch fails, fall back to the current single read, so the current BU still works.

### Step S2 — Auto-open once per login

Needs: —

- **Path:** `use-getting-started.ts`
- **Code:** key `openedInLogin` by the user object alone, not by BU:

Old:
```ts
const openedInLogin = new WeakMap<object, Set<string>>();
// … openedInLogin.get(user)?.has(keyBase)
```
New:
```ts
// The panel opens by itself once per login (or reload), whichever BU the user is in.
const openedInLogin = new WeakSet<object>();
// … openedInLogin.has(user)
```

- `gs-seen` and `gs-done` stay per BU, so each BU still gets its own one-time "all set".

### Step S3 — Panel: name the BU, list the others

Needs: S1

- **Path:** `src/features/client/components/getting-started/getting-started-pill.tsx`
- **Explanation:**
    - **Header:** the title becomes "Getting started · <BU name>" when the user has more than one BU.
    - **Other BUs:** under the steps, a section **Other business units** lists each unfinished BU with its count (e.g. "Service 002 · 1/6") and a **Switch** button. **Switch** calls `handleBuChange(String(bu.buId))` and keeps the panel open, so the new BU's steps appear.
    - **Current BU done:** when the current BU is finished but others are not, its "all set" message stays short and the others list sits right below it.
- **Path:** `src/constants/messages.ts`: `GS_OTHER_BUS` ("Other business units still to set up").

### Step S4 — Pill: count all the user's BUs

Needs: S1

- **Path:** `getting-started-pill.tsx`, `use-getting-started.ts`
- **Explanation:**
    - **When it shows:** while the current BU is unfinished, or any other BU is.
    - **Badge:** the current BU's count ("2/6") while it is unfinished. Once it's done but another BU isn't, a tick plus the number of BUs left ("✓ · 2 BUs").
    - **Pulsing dot:** shows while anything is left in any BU.
    - **aria-label:** says both, e.g. "Getting started, this business unit 2 of 6 done, 2 other business units to set up".

### Step S5 — Help, developer help and checks

Needs: S1–S4

- **Staff help** (`first-time-setup`): one FAQ, "I look after several business units". Each one has its own checklist, the panel lists the others with **Switch**, and it opens by itself once per sign-in.
- **Developer help** (`dev-getting-started-checklist`):
    - the batch read built from `availableBus` (cap 25; skips schema-less and inactive BUs);
    - `openedInLogin` is now per user;
    - the pill counts every BU;
    - `require_bu_access` guards each batch item.
- **Checks:**
    - `pnpm exec tsc -b --noEmit` and `pnpm format`.
    - A user with two new BUs: the panel opens once, names the BU, and lists the other one with **Switch**.
    - **Switch** changes BU and shows its steps; moving back does not reopen the panel.
    - Finish one BU: the pill shows a tick and "1 BU".
    - An Admin of a client with established BUs plus one new BU sees only the new one.
    - A business user is never sent a BU outside their own list.
