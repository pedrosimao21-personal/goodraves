# Coding conventions

Shared coding rules for this repo, tool-agnostic. Claude Code reads these via
`CLAUDE.md`; other agents can read this file directly. Architecture, commands,
and workflow live in `CLAUDE.md` — this file is only the code-style contract.

## Single responsibility

Each file, module, and function does exactly one thing. If describing it needs
an "and"/"or", split it. The many small files under `src/db/actions/` and
`src/services/` are this rule in practice — add features by adding files, not by
growing existing ones.

## Naming

- **Functions:** verb-first camelCase (`fetchFestivals`, `buildHttpClient`).
  Boolean-returning functions use `is`/`has`/`can`/`should`.
- **Variables:** descriptive noun-based camelCase. No single letters except
  short-loop iterators (`i`, `j`).
- **Booleans:** `is`/`has`/`can`/`should` prefix (`isAuthenticated`).
- **Constants:** UPPER_SNAKE_CASE. Many shared ones live in `src/lib/constants.ts`.
- **Files:** kebab-case, named after the primary export/responsibility — never
  `utils.ts`, `helpers2.ts`.

## Hard limits (enforced)

- **Files ≤ 300 lines** (excluding imports/comments).
- **Functions ≤ 3 levels of nesting** — use early returns and guard clauses.
- **No magic numbers/strings** — extract literals with domain meaning to named
  constants. `0`, `1`, `""` in obvious contexts are fine.
- **No swallowed errors** — every `catch` handles, wraps-and-rethrows, or
  propagates. Empty or log-only `catch` blocks are not allowed.
- **No blind barrel files** — index files re-export intentionally, not
  everything in a directory. `src/db/actions/festivals.ts` is the curated example.
- **No duplicated logic** — extract shared logic once it appears twice.

## Readability

Write for the next reader who has no context. Prefer explicit constructs over
clever ones: split a multi-condition ternary into `if/else`, avoid chained calls
past ~3 levels, and don't use tricks that need a comment to explain *what* they
do. Comments explain *why* (business decisions, non-obvious constraints,
workarounds), not *what*.

## Before committing

Run `npm run lint` — linting gates merges. Formatting is handled by tooling, so
it's never a review topic.
