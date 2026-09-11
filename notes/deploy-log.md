# Deploy log

Entries are written by `/git-deploy`, newest first. Each entry describes one commit;
`Base:` is the commit it was built on, so `git diff <base>..` shows exactly that upload.

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

