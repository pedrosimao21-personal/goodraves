---
description: Commit & push to this repo as the personal GitHub account (MRVDH), then restore the work account (MRVDH-DEPT)
argument-hint: [optional commit message]
---

Commit the current changes and push them to `origin` **as the personal GitHub
account `MRVDH`**, then switch the active `gh` account back to whatever was
active before (normally `MRVDH-DEPT`). Pushing over HTTPS uses gh's credential
helper, so the active account is what authenticates the push.

Do this:

1. Run `git status` and `git diff` (staged + unstaged) to see what changed.
2. Stage the files that belong in this commit with `git add`. Don't stage
   unrelated changes.
3. Compose the commit message:
   - If `$ARGUMENTS` is non-empty, use it as the subject line.
   - Otherwise write a concise Conventional Commit subject (`feat:`, `fix:`,
     `chore:`, `docs:`, `refactor:` — match the existing `git log` style), plus
     a short body only if the change needs explaining.
   - End with the standard co-author trailer.
4. Write the message to a temp file and run the push helper. It switches to
   `MRVDH`, commits the staged changes, pushes, and **always restores the
   previous account on exit** (even if the push fails):
   ```bash
   msgfile="$(mktemp)"
   cat > "$msgfile" <<'MSG'
   <the full commit message>
   MSG
   bash .claude/scripts/gh-push-personal.sh "$msgfile"
   rm -f "$msgfile"
   ```
5. From the helper's output, confirm the push succeeded and that it printed
   `Restored active gh account: MRVDH-DEPT`. If it printed a WARNING instead,
   run the `gh auth switch` command it suggests. Report the commit hash and
   branch.

Never leave the session on the `MRVDH` account — if anything aborts before the
helper's restore ran, switch back manually with `gh auth switch --user MRVDH-DEPT`.
