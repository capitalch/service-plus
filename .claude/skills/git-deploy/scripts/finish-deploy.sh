#!/usr/bin/env bash
# finish-deploy.sh — phase 3 of /git-deploy. WRITES, COMMITS, PUSHES.
#
#   finish-deploy.sh <commit-message-file> <log-body-file>
#
# The log entry is written before staging, so it lands inside the same commit as
# the code it describes: one commit, one push per deploy.
#
# Exit codes: 0 = deployed (or NO_CHANGES), 1 = guard/arg failure,
#             3 = commit failed, 4 = push rejected (commit is local).
set -euo pipefail

fail() {
    printf 'ERROR: %s\n' "$1" >&2
    exit 1
}

MSG_FILE=${1:-}
BODY_FILE=${2:-}
[ -n "$MSG_FILE" ] && [ -f "$MSG_FILE" ] || fail "arg 1 must be a readable commit-message file"
[ -n "$BODY_FILE" ] && [ -f "$BODY_FILE" ] || fail "arg 2 must be a readable log-body file"
MSG_FILE=$(readlink -f "$MSG_FILE")
BODY_FILE=$(readlink -f "$BODY_FILE")

# --- guard: same check as collect-changes.sh -------------------------------
# scripts/ -> git-deploy/ -> skills/ -> .claude/ -> repo root
OWNER=$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd) || fail "cannot resolve the skill's own location"
ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || fail "not inside a git repository"
[ "$ROOT" = "$OWNER" ] || fail "this skill belongs to $OWNER but the working directory is in $ROOT"
ORIGIN=$(git -C "$ROOT" remote get-url origin 2>/dev/null) || fail "no 'origin' remote configured"
cd "$ROOT"

# --- nothing to do? checked BEFORE the log file is touched -----------------
if [ -z "$(git status --porcelain)" ]; then
    echo "NO_CHANGES"
    exit 0
fi

BASE=$(git rev-parse --short HEAD)
WHEN=$(date '+%Y-%m-%d %H:%M')
BR=$(git rev-parse --abbrev-ref HEAD)
LOG=notes/deploy-log.md
LOG_EXISTED=0
[ -f "$LOG" ] && LOG_EXISTED=1

# --- insert the entry directly beneath the H1, newest first ----------------
mkdir -p notes
python3 - "$LOG" "$BODY_FILE" "$WHEN" "$BR" "$BASE" <<'PY'
import os, sys

log, body_path, when, br, base = sys.argv[1:6]

body = open(body_path, encoding="utf-8").read().rstrip("\n").split("\n")
for i, line in enumerate(body):
    if line.startswith("Files:"):
        body[i] = line.rstrip() + " — Base: " + base
        break
else:
    body.append("Base: " + base)

entry = "## %s (%s)\n%s\n" % (when, br, "\n".join(body))

if os.path.exists(log):
    lines = open(log, encoding="utf-8").read().split("\n")
else:
    lines = ["# Deploy log", "", "Entries are written by `/git-deploy`, newest first.", ""]

at = next((i for i, l in enumerate(lines) if l.startswith("## ")), len(lines))
while at > 0 and lines[at - 1].strip() == "":
    at -= 1
out = lines[:at] + ["", entry.rstrip("\n"), ""] + lines[at:]

text = "\n".join(out)
while "\n\n\n" in text:
    text = text.replace("\n\n\n", "\n\n")
if not text.endswith("\n"):
    text += "\n"
open(log, "w", encoding="utf-8").write(text)
PY

restore_log() {
    if [ "$LOG_EXISTED" = "1" ]; then
        git reset -q -- "$LOG" 2>/dev/null || true
        git checkout -q -- "$LOG" 2>/dev/null || true
    else
        git reset -q -- "$LOG" 2>/dev/null || true
        rm -f "$LOG"
    fi
}

# --- stage everything, commit once -----------------------------------------
git add -A
if ! git commit -F "$MSG_FILE"; then
    restore_log
    printf 'ERROR: commit failed — log entry rolled back, nothing pushed\n' >&2
    exit 3
fi

SHA=$(git rev-parse --short HEAD)
FILES=$(git show --numstat --format= HEAD | wc -l)

# --- push -------------------------------------------------------------------
if git rev-parse --abbrev-ref --symbolic-full-name '@{u}' >/dev/null 2>&1; then
    PUSH_CMD=(git push)
else
    PUSH_CMD=(git push -u origin "$BR")
fi
if ! "${PUSH_CMD[@]}"; then
    echo "PUSH_FAILED sha=$SHA branch=$BR — commit is local, nothing was rewritten"
    exit 4
fi

echo "DEPLOYED sha=$SHA base=$BASE branch=$BR files=$FILES"
# git@host:owner/repo.git and https://host/owner/repo.git both -> https://host/owner/repo
WEB=$(printf '%s' "$ORIGIN" | sed -e 's|^git@\([^:]*\):|https://\1/|' -e 's|\.git$||')
case "$WEB" in
    https://*) echo "URL=$WEB/commit/$SHA" ;;
    *) echo "URL=(origin $ORIGIN is not an http remote — sha $SHA)" ;;
esac
