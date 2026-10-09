# Lite plan — complete workflow

## Goal

- Describe, end to end, what happens to a workshop on the free **Lite** plan: finding the plan on the portal, signing up, approval, first login, daily use, and moving to a paid plan.
- Record the Lite plan as it now stands on the portal (decided 2026-10-09): **free, no setup fee, 1 user, 1 branch (head office only), 100 jobs a month, 20 WhatsApp messages a month, spare-parts inventory included.**
- Show clearly which of those limits the software enforces today and which are only promises on the pricing page.

## Who is involved

- **Visitor / applicant** — the shop owner, on service-plus-portal (the marketing and pricing site).
- **Approver** — an admin (user type `A`) of the **default customer database**, the shared tenant database that holds every Lite, Basic and Standard business unit. Works in the client app under `/admin/enquiries` and `/admin/subscriptions`.
- **Manager** — the applicant once approved: the single login created for the new business unit (BU).
- **Server** — service-plus-server: the public REST API for the portal, and GraphQL for the admin screens.

## Present context — where Lite lives

- **Plan definition (portal):** `service-plus-portal/content/pricing.ts`. Holds the limits and taglines shown on the pricing cards, the comparison table, the plan recommender and the search-engine data. Prices only are replaced live from the server's `.env` through `GET /api/public/plan-prices`; Lite is ₹0 with ₹0 setup.
- **Sign-up records:** table `security.sales_enquiry` in the default customer database (never the control-plane database). Enterprise enquiries go elsewhere and are not part of this workflow.
- **Plan on the business unit:** columns on `security.bu` — `plan_code = 'lite'`, `branch_limit = 1`, `billing_required = false`, `monthly_fee_paise = 0`, `paid_through = null`.
- **Server code:** `app/routers/public/website_router.py` (public endpoints), `app/services/signups.py` (sign-up), `app/graphql/resolvers/bu_admin/signups.py` (approve / reject), `app/graphql/resolvers/bu_admin/billing.py` (plan change and payments), `app/core/billing.py` (billing status rules).
- **Client code:** `src/features/admin/pages/enquiries-page.tsx`, `src/features/admin/components/approve-enquiry-dialog.tsx`, `src/features/admin/pages/subscriptions-page.tsx`, `src/features/admin/components/change-plan-dialog.tsx`, `src/features/client/components/masters/branch/branch-section.tsx`.

## Workflow brief

- The visitor picks Lite on the pricing page → Stage 1.
- The visitor fills the sign-up form and confirms → Stage 2.
- The server saves the request and emails the applicant and the approvers → Stage 3.
- The applicant can check progress on the status page → Stage 4.
- An approver creates the business unit and Manager, or rejects the request → Stages 5 and 6.
- The Manager sets a password and logs in → Stage 7.
- The shop works on Lite, within its limits → Stage 8.
- The shop moves to Basic or Standard (or back) → Stage 9.

## Key constraints

1. **Lite is approved, not sold.** Every other plan starts with a sales call or a setup payment; Lite has neither, so a person must still check each request before a database schema is created for it. Resolution: Lite requests wait in the approvers' queue, but the approve button is enabled at once (no payment gate).
2. **No one may learn who already has an account.** Resolution: a duplicate sign-up (same mobile or email on a pending or approved request, or an existing user with that email) always gets one generic "already applied" message, whatever matched.
3. **Approval cannot run as one transaction.** It creates a schema, a user and sends an email over several connections. Resolution: approval is resumable. Each finished part is recorded on the request; a 10-minute claim stops two clicks provisioning twice; a failure releases the claim so the next click continues where it stopped.
4. **Lite must never become view-only.** Resolution: `billing_required = false`, so the billing status is always "not billed": no due banner, no reminder email, no read-only lock.
5. **Only the branch limit is enforced today.** Jobs a month, WhatsApp messages a month and the single-user rule are shown on the portal but not checked by the server or client (see "Gaps"). Resolution: none yet; recorded here so it is not mistaken for working enforcement.

## Stages

### Stage 1 — Visitor chooses Lite (portal)

- **Explanation:** the pricing page shows four plan cards, a comparison table and a four-question plan recommender.
  - The Lite card reads: Free · "For a one-person shop getting started" · 1 user · 100 jobs / month · 20 WhatsApp messages / month · spare-parts inventory · 1 branch (head office only) · 1 business unit.
  - The recommender suggests Lite when the answers are: just me, any answer on stock, WhatsApp "not yet" or "a few a week", one branch. WhatsApp on "most jobs" moves the shop to Basic, because Lite's 20 messages do not cover half of its 100 jobs.
  - Choosing Lite (from its card or from the recommender) fills the plan field of the sign-up form below.
- **Path:** `service-plus-portal/app/pricing/page.tsx`, `components/pricing/plan-card.tsx`, `components/pricing/plan-comparison-table.tsx`, `components/pricing/plan-recommender.tsx`, `content/pricing.ts`.

### Stage 2 — Sign-up form (portal)

- **Explanation:**
  - Fields: name, business name, mobile (10 digits starting 6–9), email, city / state, GSTIN (optional), message (optional). Validation errors show immediately.
  - A hidden honeypot field catches bots: if filled, the form pretends to succeed and sends nothing.
  - For Lite only, pressing the button opens a confirmation dialog repeating the business name and email ("Confirm your Lite signup"). Cancel returns to the form with everything kept; Confirm sends the request.
  - The portal calls `POST /api/public/signup` with the website key header. The branch count is not sent from the form and defaults to 1.
- **Path:** `service-plus-portal/components/pricing/sales-enquiry-form.tsx`, `components/pricing/lite-confirm-dialog.tsx`, `lib/api.ts`.

### Stage 3 — Server saves the request

- **Explanation:** in this order; any refusal stops before anything is written.
  1. Rate limit: 5 sign-ups a minute per IP.
  2. The default customer database must be configured (`DEFAULT_CUSTOMER_DB_NAME`), else "Sign-ups are not available right now".
  3. The business name must pass the BU name rule.
  4. Lite must ask for exactly one branch.
  5. Duplicate check (constraint 2).
  6. The BU name is the business name, with " (City)" added if that name is already taken.
  7. The BU code is derived from the business name: lower case, other characters to `_`, at most 26 characters, then `_2`, `_3` … while taken or reserved.
  8. A public reference is generated, such as `SP-7K3M9QX2` (no 0/O or 1/I, so it can be read over the phone).
  9. The row is saved with status `pending`, setup fee 0 and payment status `not_required`.
  10. The pending count is pushed live to the admin screens.
  11. The applicant gets a thank-you email ("Your Service+ Lite request SP-…") with a link to the status page.
  12. Every active admin of the default database, plus the address in `LITE_BASIC_STANDARD_ENQUIRY_NOTIFY_EMAIL`, gets an approver email with the details and a link to the Enquiries screen.
  - Emails are sent after saving; a failed email is logged and never fails the sign-up.
- **Visitor sees:** a success screen with the reference, a recap of what was sent, the next steps (we approve, we create your business unit and send login details, you sign in) and a "Check your request status" link.
- **Path:** `service-plus-server/app/routers/public/website_router.py`, `app/services/signups.py`, `app/services/signup_emails.py`; portal `components/pricing/enquiry-success.tsx`.

### Stage 4 — Status check (portal)

- **Explanation:** at `/signup-status` the applicant enters the mobile and email used to sign up (both must match the same request; 10 checks a minute per IP).
  - Pending — "Your request is pending approval."
  - Approved — the login email the details were sent to, and the client name to pick at login.
  - Rejected — the reason the approver gave.
  - No match — "No request found for this mobile number and email."
- **Path:** `service-plus-portal/app/signup-status/`, `components/signup/signup-status-form.tsx`; server `POST /api/public/signup/status`.

### Stage 5 — Approval (client app, admin mode)

- **Explanation:**
  - The approver opens **Admin → Enquiries**. Lite rows have no "Record payment" action; **Create BU & Manager** is enabled straight away.
  - The dialog proposes the BU name, BU code and Manager username (from the part of the email before `@`). Each can be edited, with live availability checks, until a BU exists.
  - Approval runs these parts, each recorded so a retry resumes (constraint 3):
    1. **Claim** the request (10-minute lock).
    2. **Payment gate:** `not_required` passes for Lite.
    3. **BU row** in `security.bu`, checking the code and name are valid and unused.
    4. **Schema:** cloned from the `demo1` template and seeded. A half-built schema left by an earlier failure is dropped and rebuilt.
    5. **Plan stamp:** `plan_code = lite`, `branch_limit = 1`, `billing_required = false`, fee 0, `paid_through` empty.
    6. **Head office:** the applicant's city and GSTIN are written on the head-office branch and its Main division.
    7. **Manager user:** the username is made valid (letters and digits, at least 5), numbered if taken, and given the MANAGER role on the new BU. An email goes out with the username, the client name, and a link to set a password.
    8. **Finish:** status `approved`, reviewer and time stored, audit log entry, pending count refreshed.
  - The approver sees a success toast, or a warning if the login email failed. In that case the row shows "login email not sent", and the email can be resent from Business Users.
- **Path:** `service-plus-server/app/graphql/resolvers/bu_admin/signups.py`, `app/graphql/resolvers/bu_admin/users_roles.py`; client `src/features/admin/pages/enquiries-page.tsx`, `src/features/admin/components/approve-enquiry-dialog.tsx`.

### Stage 6 — Rejection (alternative to Stage 5)

- **Explanation:** a pending request with no BU yet can be rejected with a required reason. The applicant is emailed the reason and a status-page link, and the status page shows it. A rejected applicant may sign up again, because the duplicate check only counts pending and approved requests.
- **Path:** same files as Stage 5 (`resolve_reject_sales_enquiry_helper`).

### Stage 7 — First login

- **Explanation:** the Manager opens the link in the email and sets a password. At login they pick the client named in the email (the default customer database's client), enter the username and password, and land in client mode inside their own BU and head-office branch.
- **Path:** client login flow (`src/features/auth/`).

### Stage 8 — Daily use on Lite

- **Explanation:**
  - The full job workflow is available: intake, assignment, estimates, repair, delivery, GST or non-GST invoicing, WhatsApp updates, reports, and spare-parts inventory.
  - **Branches:** limited to one. The Add button on Branches is disabled at the limit, and the server also refuses ("Your plan includes one branch. Upgrade to Standard for more branches.").
  - **Billing:** status is always "not billed"; Lite never sees a due banner, a reminder email or a view-only lock.
  - **Terms:** limits count per BU per calendar month. We may limit or withdraw the free plan, or ask a long-standing free account to move to a paid plan, with reasonable notice.
- **Path:** `src/features/client/components/masters/branch/branch-section.tsx`, server `app/graphql/resolvers/masters/branches.py`, `app/core/billing.py`; portal `content/legal.ts`.

### Stage 9 — Moving off Lite (or back to it)

- **Explanation:** the shop asks us to change plan; an approver does it under **Admin → Subscriptions → Change plan** (Lite, Basic and Standard only; Enterprise needs its own database).
  - **Lite → Basic or Standard:** the BU gets `billing_required = true` and the plan's monthly fee from `.env`. The branch limit stays 1 for Basic and becomes unlimited for Standard. **`paid_through` is still empty, so the BU turns view-only at once until the first monthly payment is recorded.** The approver should record the payment (Subscriptions → Record payment, 1–60 months) in the same sitting. No setup fee is charged through this path; agree it with the customer separately if one is due.
  - **Basic or Standard → Lite:** refused while the BU has any branch besides the head office; the dialog lists the branches to delete first. Otherwise billing is switched off and the branch limit set to 1.
  - Every change is audited and the BU's cached billing state is cleared.
- **Path:** `service-plus-server/app/graphql/resolvers/bu_admin/billing.py`; client `src/features/admin/pages/subscriptions-page.tsx`, `src/features/admin/components/change-plan-dialog.tsx`.

## Gaps — new Lite limits versus what is enforced

- **100 jobs a month:** not enforced. No count or block exists on job intake in the server or client.
- **20 WhatsApp messages a month:** not enforced. Lite BUs can send unlimited messages.
- **1 user:** not enforced. An admin can add more business users to a Lite BU.
- **Spare-parts inventory:** included in Lite now, and nothing blocks it. The idea in `service-plus-portal/plans/plan.md` of showing Lite users an "inventory comes with Basic" card is no longer needed.
- **1 branch:** enforced, in both the client and the server.
- **Out of date elsewhere:** `service-plus-portal/plans/plan.md` still describes Lite as 50 jobs, no inventory and no WhatsApp. The server and client help articles may also need the new limits once enforcement is built.
