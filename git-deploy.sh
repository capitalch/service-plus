#!/bin/bash
# Manual fallback. The normal path is /git-deploy in Claude Code, which writes a
# real commit message and a notes/deploy-log.md entry instead of "init".
git add .
git commit -m "init"
git push
