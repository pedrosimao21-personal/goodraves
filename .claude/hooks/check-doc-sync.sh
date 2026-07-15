#!/usr/bin/env bash
# Stop hook: nudge Claude to keep docs in sync when watched code paths change.
#
# Reads the Stop hook JSON on stdin. If a watched code path was modified in the
# working tree without its paired doc, it emits a `block` decision with a
# reminder so Claude addresses it before finishing. Fires at most once per turn
# (honours stop_hook_active) so it can't loop.
set -euo pipefail

input=$(cat)

# Already blocked once this turn — let the stop through to avoid a loop.
if printf '%s' "$input" | grep -Eq '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
  exit 0
fi

repo_root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$repo_root"

# Working-tree changes (modified + staged + untracked). cols 1-2 are status flags.
changed=$(git status --porcelain | cut -c4-)
[ -z "$changed" ] && exit 0

changedMatches() { printf '%s\n' "$changed" | grep -Eq "$1"; }

reminders=""

# schema.ts <-> README schema overview + CLAUDE key-tables list
if changedMatches '^src/db/schema\.ts$' && ! changedMatches '^(README|CLAUDE)\.md$'; then
  reminders+=$'\n- src/db/schema.ts changed: update the schema overview in README.md and the key-tables list in CLAUDE.md if tables/columns changed.'
fi

# scripts/ <-> CLAUDE Commands block (+ README for user-facing commands)
if changedMatches '(^|[[:space:]])scripts/' && ! changedMatches '^CLAUDE\.md$'; then
  reminders+=$'\n- scripts/ changed: update the Commands block in CLAUDE.md (and README.md if a user-facing command changed).'
fi

# package.json <-> CLAUDE/README Commands (only matters for npm-script changes)
if changedMatches '^package\.json$' && ! changedMatches '^(README|CLAUDE)\.md$'; then
  reminders+=$'\n- package.json changed: if you added/renamed an npm script, update the Commands block in CLAUDE.md and README.md.'
fi

[ -z "$reminders" ] && exit 0

reason="Docs may be out of sync with your code changes. Update them, or confirm no doc change is needed, then stop:${reminders}"
# Minimal JSON string escaping (backslash, quote, newline).
reason=${reason//\\/\\\\}
reason=${reason//\"/\\\"}
reason=${reason//$'\n'/\\n}
printf '{"decision":"block","reason":"%s"}\n' "$reason"
exit 0
