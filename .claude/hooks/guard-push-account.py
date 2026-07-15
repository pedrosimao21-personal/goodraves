#!/usr/bin/env python3
"""PreToolUse(Bash) guard: deny `git push` when the active gh account is the
work account (MRVDH-DEPT). Personal-repo pushes must run as MRVDH.

Reads the hook JSON on stdin. Denies only when the command genuinely runs
`git push` AND the active gh account is the blocked one. Fail-open: any parse
or detection error allows the command, so unrelated Bash is never blocked."""
import json
import os
import re
import sys

BLOCK_ACCOUNT = "MRVDH-DEPT"
GIT_OPTS_WITH_VALUE = ("-C", "-c", "--namespace", "--git-dir", "--work-tree", "--exec-path")


def allow():
    sys.exit(0)


def is_git_push(command):
    """True if any shell segment invokes `git ... push` (push as the subcommand,
    not merely the word "push" inside an argument like a commit message)."""
    for segment in re.split(r"&&|\|\||[;\n|]", command):
        tokens = segment.split()
        i = 0
        # Skip leading environment assignments (VAR=value).
        while i < len(tokens) and re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", tokens[i]):
            i += 1
        if i >= len(tokens) or os.path.basename(tokens[i]) != "git":
            continue
        i += 1
        # Skip git global options and any values they consume.
        while i < len(tokens) and tokens[i].startswith("-"):
            opt = tokens[i]
            i += 1
            if opt in GIT_OPTS_WITH_VALUE:
                i += 1
        if i < len(tokens) and tokens[i] == "push":
            return True
    return False


def active_account():
    """The active github.com account per gh's local hosts.yml (offline-safe)."""
    try:
        with open(os.path.expanduser("~/.config/gh/hosts.yml")) as handle:
            lines = handle.readlines()
    except OSError:
        return None
    host = None
    for line in lines:
        if re.match(r"^\S", line):  # top-level host key, e.g. "github.com:"
            host = line.strip().rstrip(":")
        elif host == "github.com":
            match = re.match(r"^\s+user:\s*(\S+)\s*$", line)  # host-level active user
            if match:
                return match.group(1)
    return None


try:
    data = json.load(sys.stdin)
except (json.JSONDecodeError, ValueError):
    allow()

command = ((data.get("tool_input") or {}).get("command")) or ""
if not command or not is_git_push(command):
    allow()

if active_account() == BLOCK_ACCOUNT:
    reason = (
        f"Blocked: the active gh account is {BLOCK_ACCOUNT}. This is a personal repo "
        "— pushes must go out as MRVDH. Use the /push command (it switches to MRVDH, "
        "pushes, and restores the previous account), or run: gh auth switch --user MRVDH"
    )
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }
    }))
