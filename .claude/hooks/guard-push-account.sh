#!/usr/bin/env bash
# PreToolUse (Bash) guard: deny a `git push` on this repo when the active gh
# account is the work account (MRVDH-DEPT). This is a personal repo — pushes
# must go out as MRVDH. Use the /push command, which switches accounts for you.
#
# Fast path: if the command can't contain a push, allow it without spawning
# Python. Fail-open everywhere else so unrelated Bash is never blocked.
set -uo pipefail

input=$(cat)
printf '%s' "$input" | grep -q 'push' || exit 0
printf '%s' "$input" | python3 "$(dirname "$0")/guard-push-account.py"
