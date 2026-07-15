#!/usr/bin/env bash
# Commit the currently-staged changes and push to origin as the personal GitHub
# account (MRVDH), then restore whichever gh account was active before (normally
# MRVDH-DEPT). The restore runs on EXIT via a trap, so a failed, denied, or
# interrupted run never leaves you stranded on the wrong account.
#
# Usage: .claude/scripts/gh-push-personal.sh <path-to-commit-message-file>
set -uo pipefail

PUSH_ACCOUNT="MRVDH"
HOST="github.com"

msg_file="${1:-}"
if [ -z "$msg_file" ] || [ ! -f "$msg_file" ]; then
  echo "usage: $0 <path-to-commit-message-file>" >&2
  exit 2
fi

prev_account=$(gh api user --jq .login 2>/dev/null || true)

restore() {
  local target="${prev_account:-}"
  [ -z "$target" ] && return 0
  [ "$target" = "$PUSH_ACCOUNT" ] && return 0
  if gh auth switch --hostname "$HOST" --user "$target" >/dev/null 2>&1; then
    echo "Restored active gh account: $target"
  else
    echo "WARNING: could not restore gh account. Run: gh auth switch --user $target" >&2
  fi
}
trap restore EXIT

if ! gh auth switch --hostname "$HOST" --user "$PUSH_ACCOUNT" >/dev/null 2>&1; then
  echo "Failed to switch to gh account $PUSH_ACCOUNT" >&2
  exit 1
fi
echo "Switched active gh account: $PUSH_ACCOUNT"

git commit -F "$msg_file" || exit 1
git push || exit 1
