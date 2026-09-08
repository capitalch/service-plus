# Deploy log

Entries are written by `/git-deploy`, newest first. Each entry describes one commit;
`Base:` is the commit it was built on, so `git diff <base>..` shows exactly that upload.

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

