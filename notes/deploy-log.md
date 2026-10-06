# Deploy log

Entries are written by `/git-deploy`, newest first. Each entry describes one commit;
`Base:` is the commit it was built on, so `git diff <base>..` shows exactly that upload.

## 2026-10-06 23:48 (main)
Docs: plan internal notes on jobs

- plans/plan.md: replace the shipped Device-column plan with the job internal notes design
- plans/plan.md: new job_internal_note table; anyone appends, Admin/Manager edit or delete via new right JOBS_INTERNAL_NOTES_MANAGE (id 21)
- plans/plan.md: server-only table guard, three dedicated mutations, migration runner, Job Details panel and Job Control chip
- plans/prompt2.md: new prompt for the internal notes feature

Files: 2 changed (+404 / -156) — Base: 8c7317f

## 2026-10-06 15:37 (main)
Client: SN-labelled Device column, technician reports, On Hold steps

- Job and report grids: every Device column is headed "Device" and shows the serial as a teal "SN: <value>" line via shared/device-cell.tsx; Opening Jobs gains a Device column and shows Alt on its own line
- Server SQL: grid and report job queries return serial_no as its own column; new technician queries (product split, product jobs, monthly warranty) in sql_reports_audit.py
- Reports: Technician Profit Report replaced by Technician Reports 1-3 (monthly, monthly with warranty, technician x product) with job drill-downs
- Jobs: warranty jobs may finalize spare/parts charges at 0 cost; On Hold offered from Received, Assigned, Estimated, Estimate Approved and Received Back; setting a technician on a final or delivered job no longer logs a transaction
- Portal: new /workflow page (stage explorer, swimlane board, status map), added to the sitemap
- Help and plans: both help files updated for all of the above; plans/plan.md now holds the Device/SN plan; start script opens portal terminals

Files: 60 changed (+1725 / -1306) — Base: 31aeaef

## 2026-10-04 21:28 (main)
Client: idle logout, fresher config edits, switch for boolean settings, portal form trim

- client auth: sign out after 3 hours without input (useIdleLogout in ClientLayout) with a 5-minute warning toast; timings in constants/timing.ts
- client config: app-setting, branch, division and admin BU edits now refresh Redux (loadAppSettings, refreshBuContext, network-only fetches); associate-role and seed-roles dialogs say users must sign in again
- client app settings: true/false settings edit with an on/off switch; Admin tab, mobile link and "Unposted documents" bell entry hidden when post_data_to_accounts is off
- client admin/jobs: Manager role preselected in Add Business User; Set Technician dialog added to Job Control
- server seed: Main division gets default prefixes (MR, SI, SR, SI, RI) when a BU is created, idempotent on re-seed
- portal: "Branches needed" removed from the subscription form, request and recap
- docs: both help files updated; notes reorganised (knowledgebase folder, Marketting.md); .gitignore ignores src/**/.claude/

Files: 34 changed (+447 / -1117) — Base: 33d1c66

## 2026-10-03 15:05 (main)
Docs: archive plan2 and add a subscription test checklist

- plans: move the finished plan2.md (Main division per branch) to plans/history/
- notes/todo.md: add an end-to-end subscription test checklist — demo site
  access, Super Admin customers client, Lite enquiry-to-login cycle, and the
  same cycle for Basic, Standard and Enterprise

Files: 2 changed (+26 / -381) — Base: cfd7c6d

## 2026-10-03 11:25 (main)
Billing: sign-up approval, monthly payments, view-only guard, Main division

- Divisions (plan2): every branch gets a default Main division via a new
  addBranch mutation; division.is_default, cascading branch FK, upgrade script;
  genericUpdate refuses branch inserts and deleting/deactivating a default
- Sign-up (plan Steps 7-8): /plan-prices, /signup, /signup/status and
  Enterprise-only /sales-enquiry with emails; portal live prices, Lite confirm
  dialog, references and a sign-up status page
- Approval (Steps 9-10): Admin and Super Admin Enquiries screens; resumable,
  payment-gated BU/Manager and Enterprise client provisioning; extra-BU fees
- Billing (Steps 11-14): require_bu_writable view-only guard on BU writes,
  branch limit and changeBuPlan, monthly payments and Enterprise controls,
  daily reminders, Subscriptions screens, banner and read-only dialog
- Tests, help articles, plan.md/plan2.md and refreshed schema dumps and types

Files: 89 changed (+3394 / -563) — Base: 3ca4837

## 2026-10-02 19:53 (main)
Security: isolate BUs in shared databases; plan single-division BUs

- auth_guards / genericUpdate: business users can no longer send the security, public or empty schema (only their own last-used BU/branch row); sales_enquiry, bu_payment and the bu billing columns are refused to everyone
- Subscriptions: socket token checked at connect; each event reaches only its tenant and, for business users, its BU; genericSubscription removed, salesEnquiryCount added
- Media: upload, delete and reorder check tenant, BU and client code against the token
- Sign-up billing tables applied (Your Part D): regenerated client types and schema dumps; DDL script skips a missing template database
- Help: new "Shared-Database Isolation" developer article, stale articles fixed, staff FAQ on access and live updates
- Plans: Step 6 marked built in plan.md; new plan2.md for one fixed "Main" division per branch on sign-up BUs
Files: 26 changed (+1501 / -107) — Base: 85cc99e

## 2026-10-02 15:40 (main)
Security: guard every resolver; sign-up and billing foundations

- server/auth_guards, mutation, query: every GraphQL resolver now checks the caller (Super Admin only, own admin, or own tenant + BU); non-admins can no longer run sqlIds that read security.* tables or unlisted update scripts; tests enforce both
- server/sign-up and billing: default customer database setting, isDefaultCustomerDb login flag, enquiry and billing table scripts (no triggers), price list from .env, billing date rules with tests, and scripts/run_signup_billing_ddl.py for Part D
- server/mailers: set-password links use the browser's allowed Origin, so they open the client instead of the API port in local dev
- client/admin: a new tenant's admin with no business unit gets "Go to Admin Mode" instead of a logout-only dead end; BU names accept real business names like "Nav Technology Pvt Ltd."
- client/reports: Event Tracking adds -2 and -3 periods for day, week, month, quarter and year, grouped headers with date tooltips, and full column names in exports
- docs: plan.md Steps 1–5 marked built, advance-payment and no-trigger amendments; both help files updated; .env.example updated (contents not read)

Files: 28 changed (+1362 / -331) — Base: a4f1173

## 2026-10-02 00:53 (main)
Docs: review and shorten the sign-up and monthly-billing plan

- plans/plan.md: Step 3 now closes the hole where a business user can run any SqlStore id (e.g. RESET_ADMIN_PASSWORD) from their own BU schema, via sqlId allowlists
- plans/plan.md: approval resume reworked (BU row saved with the enquiry, new bu_schema_ready_at) since the BU table script cannot run twice
- plans/plan.md: branch limit enforced by a database trigger; payments lock the BU row; new startClientBilling for existing customers
- plans/plan.md: extra Enterprise BU confirmed at Rs 3,000 per month; duplicated context, testing and flag text condensed (860 -> 448 lines)
- plans/history: full pre-shortening copy of the plan kept for reference

Files: 2 changed (+351 / -724 in plan.md, plus 1 new file) — Base: 22e3ef9

## 2026-10-01 23:56 (main)
Jobs: remove one-time warranty invoice backfill screen and mutation

- Jobs sidebar/page: drop the Admin-only Warranty Invoice Backfill screen, its menu item and page case
- Server: remove createBackfillJobInvoice (schema, resolver, helper) and its four backfill-only SQL queries; createJobInvoice untouched
- Constants: drop the backfill GraphQL op, SQL id and WARRANTY_BACKFILL messages
- Help: staff article replaced by a short note on W-numbered backdated invoices; developer article records what was removed and keeps the W-series invariant
- Plans: warranty-charges plan Step 12 marked done and moved to plans/history

Files: 15 changed (+18 / -1028) — Base: 301eaa5

## 2026-10-01 20:05 (main)
Jobs: warranty jobs priced and invoiced like any job; W-series backfill

- Final a Job / Job Control: warranty is only a ₹0 starting price, not a lock — full pricing grid, real amount saved, HSN/GST skipped only on ₹0 warranty lines; Job Control now loads the job type
- Job Charges, Part Used, read-only charges view, Receipts: warranty prices editable and shown as saved; cost edits keep a typed warranty price; warranty jobs can take receipts
- Delivery: shared job-invoice builder; no invoice for any ₹0 job (client and createJobInvoice on the server); amount above ₹0 with all lines at ₹0 is skipped with a warning
- Server: Batch Warranty skips jobs with a priced charge; new GET_WARRANTY_JOBS_MISSING_INVOICE and admin-only createBackfillJobInvoice (delivery-dated, W-numbered)
- Jobs → Warranty Invoice Backfill: one-time Admin screen to invoice past priced warranty jobs
- Help: staff and developer articles rewritten for the new warranty rules and backfill; plan steps 1–11 marked done

Files: 25 changed (+906 / -704) — Base: 3a67ca3

## 2026-10-01 15:37 (main)
Docs: live server prices for the portal; warranty-charges fix plan

- plans/plan.md: prices live only in the server's .env; portal fetches them on each page load from a new GET /api/public/plan-prices, with built-in fallback amounts
- plans/plan.md: drop the portal .env.local price copy and the displayed-fee mismatch check; record the 1 Oct pricing decision in Step 1 and the flags
- plans/plan-fix-warranty-charges.md: new plan so warranty jobs can carry real charges, get invoiced when above zero, and backfill missing invoices
- notes/todo.md: add bug "warranty parts show as loss although charged to customers"
- server .env.example: updated (contents not read by the deploy)

Files: 4 changed (+21 / -12, plus new plan file) — Base: 3a1d39f

## 2026-10-01 00:02 (main)
Docs: subscription-plan sign-up plan; portal per-plan branch limits

- plans/plan.md: rewrite as one step-by-step plan for Lite/Basic/Standard sign-up in the default customer database and Enterprise via Super Admin, with setup-fee gate, monthly view-only billing, branch limits and your-part steps interleaved
- plans/plan.md: record Step 1 decisions and put "guard every resolver" first after finding many GraphQL resolvers callable without a login
- portal pricing: Lite and Basic get one branch (head office), Standard and Enterprise unlimited, shown on cards, comparison table, features, proof text and a new FAQ
- portal enquiry form and recommender: refuse more than one branch for Lite/Basic; send 2-5 branches to Standard and more to Enterprise
- portal FAQ: downgrading needs extra branches' data and the branches deleted first
- server .env.example: updated with a new Customer settings section (contents not read by the deploy)

Files: 12 changed (+832 / -165) — Base: 3aa3002

## 2026-09-29 20:27 (main)
Portal: add customer testimonials, drop home stat strip; Lite signup plan

- Portal home: replace the empty testimonial carousel with an always-visible TestimonialSection showing two Kolkata service-centre managers (Casio and Sony authorised), with a new intro line and the heading "What service centres say"
- Portal content: testimonials now carry paragraph-split quotes and a service-centre field; proof-section comments no longer describe testimonials as missing
- Portal home: remove the derived-number stat strip under the hero along with content/stats.ts and the CountUp component
- Plans: replace plan.md with the Lite self-signup design (tenant-admin approval, shared default customer DB, server-side isolation fixes); refresh prompt.md; remove obsolete prompt1/prompt2
- Dev help: portal article describes the live testimonials instead of an empty list
- start-all-terminals.sh: comment out the trace-plus windows and open a service-plus-portal shell
Files: 16 changed (+237 / -763) — Base: 9ca0636

## 2026-09-29 15:18 (main)
Portal: features/privacy/terms pages, redesigned home and pricing, real screenshots

- service-plus-portal: new /features, /privacy and /terms routes (legal.ts, proof.ts, stats.ts content), plus sitemap entries
- home: new hero visual, owner benefits, proof and service-centre sections; animated tabs, count-up, scroll progress and mobile action bar
- pricing/contact: rewritten sales enquiry form, plan recommender, richer enquiry-success card, contact enquiry form
- screenshots: 42 real demo-tenant captures replace the placeholders; branches.jpg removed, existing images recompressed
- client help: dev-help-content portal article updated for the new routes, content files and screenshot notes
- plans/notes: plan.md rewritten, plan-codex.md moved to plans/history, todo.md domain candidates added

Files: 53 changed (+1570 / -1352) — Base: 9a44895

## 2026-09-27 19:51 (main)
Portal: add service-plus-portal marketing site and sales enquiries

- service-plus-portal: new Next.js static site (home, pricing, contact) with
  4 plans from content/pricing.ts, screenshot gallery and a sales enquiry form
- service-plus-server: POST /api/public/sales-enquiry saves to
  service_plus_client.public.sales_enquiry, then emails; scripts/sales_enquiry.sql
  (no triggers); localhost:3005 added to default CORS origins
- Schema: regenerated service_plus_client dumps and db-schema-client types
  for sales_enquiry
- Help: new developer article for the portal and enquiries; registry DB
  article now lists two tables
- Chore: root .gitignore covers Next.js build output; portal env example
  file added (contents not read); old plan files replaced by the portal plan

Files: 17 changed (+757 / -1158) — Base: 15588b7

## 2026-09-26 20:03 (main)
Admin: revert Manager-created users and subscription tiers

- Client: removed the Manager "Users" self-service screen and its Add User
  dialog, the Branches pickers in the Admin create/associate-user dialogs, the
  Basic-tier Admin-tab hiding hooks, and the Subscription Tier field on Super
  Admin's Edit Client.
- Server: dropped the Basic-tier one-user/one-branch caps, the
  USERS_MANAGE_OWN_BU right and its seed row, per-user branch-restriction
  storage and validation, and subscription_tier from the login path and the
  client reads.
- Security guards kept deliberately: createAdminUser stays Super-Admin-only,
  createBusinessUser/setUserBuRole narrow back to require_own_tenant + {"A"},
  and createBuSchemaAndFeedSeedData is unchanged at {"S", "A"} so tenant Admins
  can still create BUs.
- Database: dropped security.user_bu_role_branch from both tenant DBs,
  public.client.subscription_tier, and access right 21; schema dumps and
  sql_bu_admin_ddl.py regenerated, the latter byte-identical to pre-feature.
- Help: deleted the "Manager-Created Users & Subscription Tiers" developer
  article and the end-user Users/branch-restriction sections, and corrected the
  Gap 3 security article, which still described the kept guards as {"A", "B"}.
- Docs: added plans/revert.md with a per-step record and verification results;
  renamed the scratch plan files to descriptive names.

Files: 46 changed (+107 / -2911) — Base: 7caa4b7

## 2026-09-26 11:49 (main)
Docs: add more domain-name candidates to marketing notes

- notes/todo.md: extend the available-domain brainstorm list with
  myserviceplus, servicebyte, serviceforge, servicevice.com, servicequick,
  and serviceside.

Files: 1 changed (+1 / -1) — Base: 6a42868

## 2026-09-25 20:38 (main)
Docs: portal hosting plan and fleshed-out subscription tiers

- plans/plan3.md: new — how to stand up the myserviceplus.in marketing portal.
  Concludes a fully static Next.js export on MilesWeb cPanel, with zero changes
  to the Cloudjiffy production env and no API calls: the two sites are joined
  only by the app's Login hyperlink.
- plans/plan3.md: records why the prompt's proxy option was rejected — no Node
  runtime in the Python image, nginx already serves the SPA at /, and a proxy
  would collapse the per-IP rate limiter onto one address.
- plans/prompt2.md: new — the source prompt asking how to host and integrate a
  customer-facing portal with the production server.
- plans/prompt1.md: subscription model filled in — Lite renamed to Trial, and
  each of the four levels given its price, user/job/WhatsApp-message limits and
  business-unit count, plus the start of the trial-provisioning notes.

Files: 1 changed (+26 / -4) — Base: e2c4ef4

## 2026-09-25 15:36 (main)
Admin: business users grid, and Users menu is Manager-only

- Admin → Business Users: replace the card grid with a sortable/searchable
  table (Name, Username, Email, Mobile, Business Units, Role, Status,
  Actions), matching the grid pattern used elsewhere; all existing actions
  (Edit, Reset password and mail, Associate BU/Role, Activate/Deactivate,
  Delete) carry over unchanged.
- Client Mode → Admin: the "Users" nav item and its route no longer show
  for Admin/Super Admin — hasAccessRight's S/A bypass was letting it appear
  as a confusing duplicate of their own Business Users screen; it now also
  requires userType "B", both in the nav (client-explorer-panel.tsx) and as
  a second guard on the route itself (client-admin-page.tsx).
- plans/prompt1.md: add Standard and Enterprise to the subscription tier list.
- dev-help-content.ts updated to match.

Files: 5 changed (+299 / -223) — Base: feac074

## 2026-09-24 19:40 (main)
Docs: start subscription-model notes with the tier list

- plans/prompt1.md: record that the subscription model will have four levels, and name the first two — Lite (free) and Basic (paid)

Files: 1 changed (+4 / -1) — Base: d46ec9e

## 2026-09-24 16:33 (main)
Admin: rework Users into a grid, hide it for Basic-tier Managers

- Users (formerly My Team) is now an Add User button plus a searchable/sortable
  grid of the Manager's own team, with Edit/Activate/Deactivate/Delete per row,
  reusing the existing Admin business-user dialogs instead of duplicating them.
- Hide the whole Admin tab (top nav, mobile nav, explorer sidebar, and a route
  fallback for stale links) for a Manager on a Basic-tier client, since the
  one-user cap means there is never anything usable behind it.
- Fix the subscription-tier lookup that hiding depends on: the genericQuery call
  it used (db_name: "" to reach the client-registry DB) was silently rejected by
  require_own_tenant for every caller except Super Admin, so the tier was always
  null. Now the server includes subscription_tier on the login response (piggy-
  backed on the client-row lookup login already does), and the client reads it
  straight from Redux instead of re-querying — also fixes branch-section.tsx's
  pre-existing, equally-broken "disable Add Branch at the Basic cap" check.
- Both help docs (staff-facing and developer) updated to match.

Files: 14 changed (+532 / -529) — Base: 8691118

## 2026-09-23 15:53 (main)
Extended Warranty: recolour Dashboard cards, drop State column

- ew-lead-grid.tsx: removed the Details grid's separate State column; its
  EwStateBadge now renders as a second line under the purchase date in the
  Purchased column instead, so a lead's state lives in one place per row.
- ew-state-machine.ts, ew-pipeline-section.tsx: moved the Dashboard's 0-7 D,
  Interested, Stage 3 and Cancelled pipeline cards off orange/amber/red;
  Overdue and Fail then moved to a lighter orange via new optional
  lightBorderClassName/lightTextClassName overrides, without touching the
  shared colour tokens those states use elsewhere (Details grid, filter,
  row-menu, flow diagram).
- client-activity-bar.tsx: the Custom icon in the left-hand icon rail now
  hides itself the same way the top-nav Custom tab already does, for a
  tenant with no add-ons switched on.
- test_users_roles_rules.py: added the branch-restriction tests plan.md's
  Testing section called for but never had (saved/read-back, cross-BU
  branch rejected, no-restriction writes nothing).
- plan.md: documented both the test-coverage gap above and the earlier
  createBuSchemaAndFeedSeedData revert.
- plan2.md (new): a UI improvement audit covering admin-panel mobile nav,
  keyboard/screen-reader accessibility, and cross-workspace visual
  consistency.

Files: 8 changed (+174 / -22) — Base: 99e5af7

## 2026-09-18 16:03 (main)
Docs: add more domain-name candidates to marketing notes

- notes/todo.md: added servicebyte, servicebench to available domains and
  serviceforce to unavailable domains.

Files: 1 changed (+3 / -2) — Base: a72d7df

## 2026-09-18 15:34 (main)
BU admin: allow tenant Admin to create BUs; prefill numbering

- mutation.py: createBuSchemaAndFeedSeedData now allows a tenant's own Admin
  (scoped to their own tenant via require_own_tenant), not just Super Admin —
  the earlier Super-Admin-only lockdown left BU creation broken for everyone,
  since the client only exposes this to Admin and Super Admin has no
  replacement screen.
- seed_bu_data.py: new BUs now get document_sequence rows pre-filled for the
  auto-created Head Office branch — Job Sheet (J), Purchase Invoice (P),
  Purchase Return Invoice (PR) — so numbering works without a manual setup
  step; idempotent, reused by the "Add Seed Data" repair path too.
- plan.md, help-content.ts, dev-help-content.ts: documented both changes,
  including the reasoning for reopening BU creation to Admin.
- notes/todo.md: added client login credentials and more domain-name research.
- plan1.md (new): competitive research plan comparing Service+ to BytePhase.

Files: 6 changed (+70 / -13) — Base: e0de387

## 2026-09-17 15:34 (main)
Admin: let Managers create team members within their own BU

- Server: close a real gap — createBusinessUser, createAdminUser, createBuSchemaAndFeedSeedData and setUserBuRole had no authorization check at all; now Admin/Super Admin only, with Manager admitted narrowly below
- Server: new USERS_MANAGE_OWN_BU right (Manager role only) lets a Manager create Technician/Receptionist users for their own BU, never another Manager
- Server: add client subscription_tier (Basic/Pro/Enterprise); Basic caps a client to one business user (must be Manager) and one branch per BU
- Server: add optional per-branch restriction on a user's BU assignment (user_bu_role_branch), validated against that BU's own schema; schema dumps and generated DDL regenerated to match
- Client: new "My Team" screen for Managers, branch pickers on the Admin user dialogs, a tier selector on Edit Client, and 21 new automated tests
- Reports > Dashboard: fix the Open Jobs by Product summary's column alignment and add a job-detail drill-down from it
Files: 33 changed (+1323 / -634) — Base: acdae74

## 2026-09-17 11:15 (main)
Security: enforce tenant/BU ownership on generic query and update calls

- auth_guards.py: add require_own_tenant and require_bu_access, closing a gap where
  any logged-in user could point genericQuery/genericUpdate/genericUpdateScript/
  genericBatchQuery at another tenant's db_name or an unassigned BU's schema and
  have the server simply run it
- login_helper/refresh_token_helper: add a bu_codes claim to the JWT (from the
  existing GET_USER_BUS lookup); refresh_token_helper now re-runs that lookup on
  every refresh instead of never running it
- Wire both guards into all four generic dispatchers before any existing
  right-check; genericBatchQuery checks each bundled item's schema individually so
  one disallowed item rejects the whole batch instead of leaking the rest
- dev-help-content.ts: new "Tenant & BU Enforcement" article plus updates to four
  now-stale references (token claims list, request-flow steps, known-gaps
  cross-reference)
- tests/test_auth_guards.py: new unit tests for both guards (tenant/BU match and
  mismatch, Admin/Super Admin bypass rules, fail-closed on a token missing bu_codes)
- admin-layout.tsx / business-users-page.tsx: drop the BU/branch switcher from the
  admin header, show assigned BU names in a dropdown instead of just a count
- notes/todo.md: add marketing domain-name research

Files: 10 changed (+250 / -33) — Base: 7ac013a

## 2026-09-15 19:42 (main)
Chore: gitignore Claude Code sandbox placeholder files

- .gitignore: ignore the /dev/null placeholders the Claude Code sandbox
  mounts over shell rc files, .gitconfig, .mcp.json and .claude/* config
  paths, so git status stays clean and git add -A no longer fails on them

Files: 1 changed (+22 / -0) — Base: 2d54fc1

## 2026-09-15 15:19 (main)
Chore: regenerate db-schema types with a connect timeout

- db-schema-client.ts, db-schema-security.ts, db-schema-service.ts:
  re-run through pg-to-ts with ?connect_timeout=10 added to the
  generator's connection string. No column or type changes — only
  the recorded generator command in each file's header comment.

Files: 3 changed (+3 / -3) — Base: cfb0107

## 2026-09-15 15:12 (main)
Docs: add SaaS strategy plan, retire the completed EW build plan

- plans/plan.md: new strategy doc answering the multi-tenant
  subscription questions in prompt.md — the db_name/schema
  authorization gap that blocks selling to untrusting customers under
  any tenant shape, India pricing tiers (Extended Warranty excluded,
  it's Sony-only), a competitor comparison against RepairDesk and
  BytePhase, and a marketing/promotion plan.
- plans/prompt.md: replaced with the Service+ marketing/subscription
  brief this plan answers.
- plans/plan-ew-final.md, plans/prompt3.md: removed — the Extended
  Warranty rebuild plan and its brief, now fully built, tested and
  deployed (every step in the plan was already marked done).

Files: 3 changed (+7 / -2116) — Base: c81a409

## 2026-09-15 01:13 (main)
Security: require .env for DB connection settings, sanitize startup errors

- database_settings.py: client_db_host/port/name/user/ip_address and
  the service_db_* equivalents are now required Field(...)s with no
  source-level default, matching how the passwords already worked —
  real hostnames/usernames/IPs no longer sit in tracked source.
- config.py: Settings() construction is now wrapped so a missing or
  invalid .env value fails with field names only. Pydantic's default
  error embeds the full raw settings dict (every already-supplied
  secret in plaintext) in a "field required" error for an unrelated
  field, and SecretStr does not prevent it, since that happens before
  per-field type coercion — verified with fake values before and
  after the fix.
- .env.example: pre-fill *_INTERNAL_PORT with the standard Postgres
  5432 default, the one DB setting that isn't deployment-specific.

Files: 3 changed (+51 / -15) — Base: 41b7b95

## 2026-09-14 23:40 (main)
Extended Warranty: finalize period columns; Job Completion: sort by OK date

- Overall summary: settle on six period columns in a fixed order
  (Today, This week, This month, Prev month, This year, Prev year)
  after adding then removing a trailing "Over a month old" catch-all
  per user direction; ew_sql_test.py's dashboard-sum checks were
  widened to cover the three newer periods instead of the removed one.
- Lead Pipeline: a zero-count card now opens a small "No leads" Dialog
  (not AlertDialog, so Escape and outside-click dismiss it) instead of
  a toast, with its single OK button centered.
- Jobs > Customer Connect > Job Completion grid: the Date column and
  sort now follow when a job's last transaction actually moved it to
  Completed OK (job_transaction.performed_at via job.last_transaction_id),
  not the job's original intake date — which now shows on its own line
  under Job No instead.

Files: 12 changed (+168 / -83) — Base: 217faa8

## 2026-09-14 00:57 (main)
Extended Warranty: zebra-stripe the lead grid, color its filter

- ew-lead-grid.tsx: alternating rows get a faint theme-aware tint
  (even:bg-(--cl-surface-2)/40), shared by the Details tab and every
  dashboard drill-down since both render through this one grid.
- Same file: the state filter dropdown's seven options each get an
  icon and color matching their badge/row-menu color (STATE_VISUAL),
  instead of plain text.
- icon-colors.ts: register UserPlus (blue) for the new New Lead
  icon; MessageSquare already existed at the right indigo.
- Both help articles updated to describe the striping and the
  colored filter.

Files: 4 changed (+42 / -10) — Base: c4c5c02

## 2026-09-14 00:41 (main)
Extended Warranty: remove the rollout cleanup script (Step 19)

- scripts/ew_cleanup.sql: deleted now that every tenant's BU schema
  has run it (confirmed present via a live-DB check across all
  three: demo1, capitalelectronics, navtechnology).
- plans/plan-ew-final.md: mark Steps 17-19 done with status notes —
  the Part C commit sha, the live-DB verification for Step 18's
  rollout scripts, and this file's removal for Step 19.

Files: 2 changed (+25 / -47) — Base: ec28bb6

## 2026-09-14 00:30 (main)
Extended Warranty: rebuild Dashboard/Details/Flow, add live push

- Dashboard/Details/Flow: split into three tabs behind one shared New
  Lead button; the Lead Pipeline is now a two-row tinted grid with a
  "61+ D" band card and an open-leads chip, and Overall summary was
  redesigned (Message summary folded into it); standard Refresh
  buttons and colored, iconed row actions throughout.
- Live updates: every EW mutation, the sender and the public
  interest/opt-out routes now publish an EW_LEAD pubsub event
  alongside the delivery-status one; a shared use-ew-live-refresh
  hook keeps the section and the bell's Interested count current
  across sessions without a manual refresh.
- Fix: the customer's interest comment reached the grid, detail
  dialog and staff alert but not the notify e-mail, because that
  path read the lead row before the write landed — now passed
  through explicitly.
- The call/WhatsApp choice is removed from the customer's interest
  page (the shop only calls); a leftover WhatsApp preference from an
  older lead still shows, a bare "Call" no longer does.
- Details grid: the Follow-up column now shows who made the last
  follow-up and what they said, via a LATERAL join onto
  ew_lead_event — no schema migration needed.
- plans/plan-ew-final.md: mark Step 16 (end-to-end test) done with a
  status summary of what was found and fixed.

Files: 28 changed (+712 / -291) — Base: 6250b07

## 2026-09-13 11:25 (main)
Extended Warranty: remove the old module ahead of the rebuild

- server DB: drop ew_customer, ew_stage_v and the EW settings via the new
  idempotent scripts/ew_cleanup.sql; regenerate the schema dump and
  BU_SCHEMA_DDL; drop settings row 16 and the EXTENDED_WARRANTY key from seeds
- server code: delete the EW SQL store, resolvers, public router, sender
  section, sign_ew/verify_ew, the webhook EW/EL codes and three mutations; an
  old EW status callback is now logged and ignored with a 200
- client: delete the custom/extended-warranty screens, types, settings dialog,
  deep-link route, bell entry and context flag; the Custom menu is now an
  empty, hidden container; regenerate db-schema-service types
- kept for the rebuild: the two Meta-approved templates (comments reworded),
  access rights 19/20 and the Custom shell
- help and plans: remove EW from client and developer help, replace the dev
  article with a removal record; delete six superseded plan files;
  plan-ew-final.md tracks steps 1-9
- also: demo DB dump without ew_customer; migration-tool README gains a
  how-to-run section

Files: 60 changed (+172 / -7882) — Base: 01d2a99

## 2026-09-12 15:27 (main)
Extended Warranty: rebuild as Dashboard + Actions, two screens

- Follow up and close ANY lead, not just ones who tapped the button. That was the
  real gap: a customer you rang who never replied on WhatsApp had nowhere to
  record the call. APPEND_EW_FOLLOW_UP already tolerated stage = NULL, so this
  was UI-only; outcomes are now a segmented Won / Lost — not interested / Lost —
  couldn't reach / Still following up, with Lost slate, never red.
- Five tabs became two. New ew-actions-screen.tsx is one row per LEAD and
  replaces ew-due-grid, ew-interest-grid and ew-customer-grid (all deleted); a
  new ew-lead-detail-dialog.tsx shows one lead in full. Dashboard is a Lead Flow
  graphic (ew-funnel-flow.tsx) plus Leads-by-expiry, Messages sent and the
  message log.
- Server: new GET_EW_LEADS_PAGED (customer-level, with a LATERAL picking the
  current stage so never-messaged leads stay visible — they have no ew_stage_v
  row) and GET_EW_DASHBOARD_OVERVIEW (one row for the whole dashboard).
  GET_EW_DRILLDOWN gained lost/has_follow_up predicates, device columns and a
  serial join. Search now spans brand, model and serial, not just name/mobile.
- Fixed: the lead detail dialog built its per-stage chips from the row's current
  stage only, so a customer messaged at 30 and again at 7 showed the 30-day
  reminder as never sent. Every grid now carries the full per-customer send
  history via a new sends aggregate; proved with a rolled-back second send.
- Removed seven queries the rebuild made dead — GET_EW_DUE_CUSTOMERS,
  GET_EW_CUSTOMERS_PAGED, GET_EW_INTEREST_PAGED, GET_EW_DASHBOARD_KPIS,
  GET_EW_BY_BRAND, GET_EW_MONTHLY_TREND, GET_EW_FUNNEL_BY_STAGE — plus their
  sql-map mirrors and four orphaned types. Default stages are now [60, 30, 7, 0].
- Also in this upload, not mine: shared card/toolbar polish, an ambient accent
  glow and scrollbar/caret chrome in index.css, regenerated db-schema types, and
  the real entity details filled into the privacy policy.

Files: 43 changed (+4072 / -3923) — Base: da2c1e2

## 2026-09-11 15:27 (main)
WhatsApp: keep Meta's error code, add a privacy policy page

- Webhook failures now record Meta's numeric code, not just its title:
  "131049: This message was not delivered to maintain healthy ecosystem
  engagement." A marketing throttle and a permissions failure had identical-
  looking titles, so the Message Log could not tell "wait it out" from "fix the
  config" — a distinction that matters once the app is Live.
- The extraction was duplicated in the EW and job callback paths; both now call
  one _format_webhook_error(), which also folds in error_data.details, drops the
  details when Meta repeats the title verbatim, and returns None rather than
  raising on a malformed or empty payload.
- New public/privacy-policy.html: a real server-rendered page, required before a
  WhatsApp app can go Live. Meta reads the HTML source without running
  JavaScript, so the existing SPA route answered 200 with an empty shell and was
  rejected. Ships in dist automatically. Three placeholders — entity name,
  address, contact email — still need filling before submission.
- notes/Deployment.md: nginx `location = /privacy-policy` serving that file at a
  clean extensionless URL, with =404 rather than an SPA fallback so a missing
  file fails loudly instead of returning an empty 200.
- ew_enabled_merge.sql: a fifth statement brings the extended_warranty row's
  description in line with the merged shape. Guarded with IS DISTINCT FROM and
  verified a no-op against all three live schemas.
- notes/todo.md: one line added by the user, unrelated to the above.

Files: 4 changed (+52 / -10) — Base: bb23e3d

## 2026-09-11 15:00 (main)
Chore: untrack deployment/ so it stops being pushed

- deployment/ was already the last line of .gitignore, but 112 files under it
  had been tracked since the initial commit — .gitignore only applies to
  untracked paths, so git kept committing them and every deploy that refreshed
  that mirror showed up as repo changes.
- git rm -r --cached deployment/ removes them from the index only. Every file
  stays on disk untouched; the ignore rule now takes effect, so future deploys
  into that folder are invisible to git.
- Contents were never read, per the repo rule — this removes the 97 app-server
  and 10 file-server mirror files plus the deploy/extract/startup scripts.

Files: 112 changed (+0 / -23931) — Base: b53a7d2

## 2026-09-11 14:56 (main)
Extended Warranty: cast the jsonb stage path to text in the stage writers

- APPEND_EW_FOLLOW_UP failed every follow-up with "function jsonb_set(jsonb,
  smallint[], jsonb, boolean) does not exist". psycopg folds a repeated named
  placeholder into ONE parameter, so Postgres unified %(stage)s across all its
  uses and the `::smallint` on the log entry dragged the whole thing to smallint
  — making the uncast ARRAY[%(stage)s] a smallint[]. Now cast to ::text.
- A second bug was hidden behind it: `stages -> %(stage)s` with a smallint
  resolves to `jsonb -> integer`, which is ARRAY indexing and returns NULL
  against an object — so even once the crash was fixed the CASE would have
  skipped and stage_status would never have advanced. Those lookups are cast too.
- CLAIM_EW_REMINDER_STAGE carries the same shape and happens to resolve to text
  today, which is why sending works. Hardened anyway: if that parameter ever
  resolved to smallint, the WHERE's stage lookup would return NULL, COALESCE
  would yield 'NONE', and the exactly-once guard would pass unconditionally —
  duplicate customer messages, silently. Documented beside the existing warning.
- Verified against the live demo1 schema: all five stage-keyed writers parse, and
  a rolled-back transaction confirmed the follow-up now sets outcome,
  outcome_at, follow_up_count and stage_status. Confirmed working in production.
- The deployment/app-server mirror also changed in this upload (updated by a
  deploy, contents not read).

Files: 9 changed (+338 / -12) — Base: ea1b134

## 2026-09-11 14:04 (main)
Chore: format the whole client with prettier (no behaviour change)

- Ran `pnpm format` across src/: 446 of 474 .ts/.tsx files were not
  prettier-clean, so every recent feature diff has been swamped by incidental
  reformatting. This lands that noise once, on its own, so future diffs show
  only real changes. Nothing outside dev/service-plus-client/src was touched.
- Verified semantically neutral rather than assumed: the build is deterministic
  (two consecutive builds produce identical asset hashes), and a before/after
  build was compared chunk by chunk. Every difference is prettier re-encoding
  JSX whitespace — swapping a literal space for an explicit {" "} child, or the
  reverse, when it rewraps a line. React renders both identically.
- Audited all 18,000 string literals in the main bundle for text that was lost
  or gained. Every difference paired up as a space moving across a boundary
  (e.g. "Activate" + {" "} becoming "Activate "); five were confirmed at source
  level. No user-visible string changed.
- `pnpm exec tsc -b --noEmit` and `pnpm build` both pass, and prettier now
  reports zero files needing formatting.

Files: 446 files changed, 95470 insertions(+), 83815 deletions(-) — Base: 8334a62

## 2026-09-11 13:56 (main)
Docs: add the Extended Warranty developer article, fix stale WhatsApp facts

- dev-help-content.ts: new "Extended Warranty Reminders — Implementation" article
  in the WhatsApp category — the single-table JSONB model and why it beat four
  normalised tables, ew_stage_v, the exactly-once claim via RETURNING id, the two
  status ladders, lead-first/notify-after ordering, the eight moving-part files,
  and the four-places access-right trap.
- dev-help-content.ts: correct six claims the feature made wrong — the event and
  template counts, TemplateSpec's button_count (documented as a named
  button_params list it no longer has), the third signing pair sign_ew/verify_ew,
  what _is_event_enabled gates, and the mutation/template/router/toggle tally.
  Added extended_warranty to the app_setting list and to whatsapp_notifications'
  keys.
- help-content.ts: the two places that still said five WhatsApp events now say
  six and name Extended Warranty, with a pointer to its own add-on switch.
- CLAUDE.md: the help rule now requires BOTH help files on every change, with a
  table splitting the two audiences and an instruction to re-check sibling
  articles for drifting counts — the exact way the developer help ended up with
  no mention of a 66-file feature.
- Most of dev-help-content.ts's diff volume is prettier reformatting a file that
  was not format-clean before; the real change is one new article plus the eight
  corrections above.

Files: 3 changed (+3303 / -1440) — Base: 530a962

## 2026-09-11 13:37 (main)
Extended Warranty: shorten the settings switch hints

- Settings dialog: the Enabled switch's hint is now just "Enable or disable
  Extended Warranty" — the two-switch caveat it used to carry moves to the
  WhatsApp notifications dialog, which is the switch that actually gates sending.
- WhatsApp notifications dialog: the Extended Warranty row's note drops the
  marketing/non-opt-in paragraph and reads "Also needs the App Settings →
  Extended Warranty to be switched on." It also moves out of the component into
  constants/messages.ts, per the convention for text over two words.
- Seed and ew_delta.sql: the extended_warranty row's description is cut from
  ~50 words to one sentence and uses the → arrow, matching the UI strings. Live
  rows in all three BU schemas were updated by hand to the same text and verified
  to match byte-for-byte.
- Most of this diff's volume is prettier reformatting
  edit-whatsapp-notifications-dialog.tsx, which was not format-clean before; the
  real change there is three lines.

Files: 4 changed (+132 / -143) — Base: fbe4434

## 2026-09-11 13:07 (main)
Extended Warranty: fold the feature flag into extended_warranty.enabled

- Settings consolidation: the visibility flag moves from its own app_setting row
  (`extended_warranty_notifications_enabled`) to the `enabled` field of the
  `extended_warranty` row, which takes id 16 so the numbering stays contiguous.
  New idempotent `scripts/ew_enabled_merge.sql` does the move, preserving a switch
  an owner had already turned on; seed and ew_delta.sql now produce the new shape.
- Server: `_is_ew_feature_enabled` is now synchronous, reading `enabled` off the
  row `get_ew_settings` already fetched instead of querying for it — one fewer
  settings round trip before every send. Still fails closed on strict `is True`.
- Client: new purpose-built `edit-extended-warranty-dialog.tsx` replaces raw-JSON
  editing of that row — switches for Enabled and Auto send, a chip editor for the
  reminder stages, validated phone/email fields. Its save spreads the stored object
  so keys it does not know about survive. `client-layout.tsx` reads the new location.
- Docs: plan.md gains a "Settings consolidation" section and records Steps 5, 5a/5b
  (templates approved by Meta) and 7a (nginx block live) as done; new plans/plan1.md
  explains every attribute of the settings row and where each enters the flow.
- Formatting: `pnpm format` on the four touched client files reformatted them in
  full — none was prettier-clean beforehand — which is most of this diff's volume.
  The substantive client edits are five message keys, three help strings and the
  two files above.
- Schema dumps and db/service_plus_demo.sql differ only in pg_dump's \restrict
  nonce; no DDL changed.

Files: 10 changed (+5694 / -3122) — Base: 75d422d

## 2026-09-10 17:39 (main)
Extended Warranty: WhatsApp renewal reminders end to end

- Server data layer: new single-table `ew_customer` model — flat columns for anything a
  grid filters on, JSONB `stages`/`follow_ups` for history — plus the `ew_stage_v`
  flattening view, `sql_extended_warranty.py`, and the `ew_delta.sql` /
  `seed_access_right_ew.sql` migration scripts.
- Server send path: two new Meta templates, `sign_ew`/`verify_ew` link tokens,
  `send_ew_reminders` and `send_ew_lead_alert`, webhook routing for the `EW`/`EL` event
  codes, and the public `/extended-warranty` interest and opt-out pages.
- Client: a new "Custom" top-nav section holding the Extended Warranty screen — customers,
  due list, interest, follow-ups and message log — with a drill-down dashboard, two new
  access rights, and the visibility/send app settings behind them.
- Hardening: WhatsApp HMAC secrets now fail at startup rather than signing with an empty
  key, and a hardcoded default was removed from `trace_plus_service_key` (value not read
  or reproduced; it remains in earlier history, so rotate it).
- Housekeeping: nginx `location /extended-warranty/` block added to notes/Deployment.md;
  six finished per-feature plans replaced by the single Extended Warranty plan.

Files: 66 changed (+5827 / -2911) — Base: 8e8a0f5

## 2026-09-08 15:13 (main)
Chore: add /git-deploy skill and trim duplicated client conventions

- .claude/skills/git-deploy: new deploy skill — a read-only collect script
  (guards the repo identity, flags suspected secrets, caps the diff) and a
  finish script that writes the log entry, commits and pushes once.
- notes/deploy-log.md: new newest-first deploy log; each entry names the base
  commit so `git diff <base>..` reproduces that upload.
- git-deploy.sh: note it is only a manual fallback now that /git-deploy writes
  a real message instead of "init".
- dev/service-plus-client/CLAUDE.md: drop the conventions, planning protocol
  and ignore-list sections that now live in the global ~/.claude/CLAUDE.md,
  keeping only the client-specific rules.
- start-all-terminals.sh: comment out the service-plus-web,
  capital-chowringhee-web and kush-infotech-web terminal launches.

Files: 3 changed (+44 / -61) — Base: 30244d4

