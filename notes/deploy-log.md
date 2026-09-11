# Deploy log

Entries are written by `/git-deploy`, newest first. Each entry describes one commit;
`Base:` is the commit it was built on, so `git diff <base>..` shows exactly that upload.

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

