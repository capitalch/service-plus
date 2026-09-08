---
name: git-deploy
description: Upload the whole service-plus repo to GitHub in one commit with an auto-written commit message describing what this upload contains, plus a dated entry in notes/deploy-log.md. Use when asked to deploy, upload service-plus to git, push my changes, or commit and push. Accepts a free-text hint, or --dry-run to preview without committing.
---

# git-deploy

Three phases: **collect → describe → commit & push.** One commit and one push per
deploy. The scripts do everything that must be exact; you do the part only a model
can do — reading the diff and saying what actually changed.

`$ROOT` below is `git rev-parse --show-toplevel`. Run every command from there.

## 1. Collect

```bash
bash "$ROOT/.claude/skills/git-deploy/scripts/collect-changes.sh"
```

Read-only. Handle its outcomes before going further:

- **`NO_CHANGES`** — tell the user there is nothing to upload and stop. Do not push.
- **`SECRET_SUSPECT: <paths>`** (exit 2) — stop. Show the paths, say they look like
  secrets, and ask whether to add them to `.gitignore` or proceed anyway. Never
  work around the guard on your own.
- **`SECRET_TRACKED: <paths>`** — these are already in the repo and changed in this
  upload. Not a blocker and not an error. Their contents were never read, so describe
  them only as "updated, contents not read" — never guess at what changed inside them,
  and mention them in the commit message so the change is not silent.
- **`ERROR:`** (exit 1) — the guard says this is not the service-plus repo. Report and stop.
- **`DIFF_TRUNCATED`** — the diff was capped. Describe the capped part from `=== STAT ===`
  rather than guessing at contents you were not shown.

## 2. Describe

From `=== DIFF ===`, `=== NEW FILES ===` and `=== STAT ===`, write the commit message:

- **Subject**: imperative, 72 chars or fewer, prefixed with the affected area —
  `General ledger:`, `Sales:`, `trace-server:`, `Docs:`, `Chore:`. For a mixed upload,
  lead with the dominant area and cover the rest in the bullets.
- Blank line, then **3–6 bullets**, each `- <file or area>: <what changed>`.
  Describe the change, not the file list: "preserve selection across re-render",
  never "modified comp-react-select.tsx". Fewer than three real changes means fewer
  bullets — do not pad.
- Then the attribution trailer this session requires (the `Co-Authored-By:` line for
  the current model plus the `Claude-Session:` URL).

Then write the **log body** — the same subject and bullets, no trailer, plus a final
line taken from `SHORTSTAT=`:

```
Files: 3 changed (+84 / -21)
```

`finish-deploy.sh` adds the `## <date> (<branch>)` heading and appends ` — Base: <sha>`
to that line. Do not write either yourself.

A free-text argument is a **hint** that steers the subject line. It never replaces
reading the diff, and it is never used verbatim as the whole message.

**`--dry-run` stops here**: print the proposed commit message and log entry, and stop.
Nothing is staged, committed or pushed.

## 3. Commit & push

Write both files to the scratchpad, then:

```bash
bash "$ROOT/.claude/skills/git-deploy/scripts/finish-deploy.sh" <msg-file> <log-body-file>
```

Outcomes:

- **`DEPLOYED sha=… base=… branch=… files=…`** plus `URL=…` — relay the subject, sha,
  branch, file count and the commit URL to the user.
- **`PUSH_FAILED`** (exit 4) — the commit landed locally but the push was rejected.
  Report it and stop. Do **not** pull, rebase, merge or force.
- **exit 3** — the commit failed; the script already rolled the log entry back.
  Report the git error.

## Rules

- Never read anything under `deployment/**` or matched by `.claudeignore`
  (`.env`, `**/.env*`, `**/config.*`, `config.py`). The collect script already excludes
  them from the diff — do not go around it. They are still committed, just never read.
- Never `git push --force`, never amend or rewrite history, never switch or create branches.
  This skill only ever adds one commit to the branch already checked out.
- Never resolve conflicts or auto-pull. A rejected push is reported back to the user.
- Staging is `git add -A`: scratch files (`plans/*.md`, `CLAUDE.md`) go up with the code.
  The secret guard is the only filter.
- One commit per deploy. The log entry ships inside the commit it describes, so
  `git log --oneline -- notes/deploy-log.md` maps entries to commits one for one.
