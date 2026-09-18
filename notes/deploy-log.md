# Deploy log

Entries are written by `/git-deploy`, newest first. Each entry describes one commit;
`Base:` is the commit it was built on, so `git diff <base>..` shows exactly that upload.

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

