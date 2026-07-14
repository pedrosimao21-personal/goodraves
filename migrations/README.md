# Database migrations (node-pg-migrate)

Plain-SQL migrations applied with [node-pg-migrate](https://salsita.github.io/node-pg-migrate/),
run over `node-postgres` (`pg`) against the regular `DATABASE_URL` so each migration gets a real
transaction — the fix for the old drizzle-kit setup, whose neon-http driver had no transaction
support. The app keeps using the same `DATABASE_URL` via the neon-http driver at runtime.

Migrations run with `--no-lock`. node-pg-migrate would otherwise take a session-level advisory
lock to prevent concurrent runs, which misbehaves over Neon's pooled (PgBouncer) endpoint. For
manual, single-operator migrations that lock buys nothing, so we skip it and the pooled endpoint
works fine (transactions are unaffected — PgBouncer runs in transaction mode).

## Commands

```bash
npm run db:migrate                 # apply all pending migrations (up)
npm run db:migrate:down            # roll back the most recent migration
npm run db:migrate:create -- <name>  # scaffold migrations/<timestamp>_<name>.sql
```

Each `.sql` migration has `-- Up Migration` and `-- Down Migration` sections. Raw SQL is fully
supported (plpgsql functions, triggers, data backfills, functional indexes).

## Workflow when changing a table

1. Update `src/db/schema.ts` (Drizzle ORM types — the query/type source of truth).
2. `npm run db:migrate:create -- <name>` and write the DDL under `-- Up Migration`
   (and a real `-- Down Migration`).
3. `npm run db:migrate`.

Keep `schema.ts` and the migration in sync by hand — Drizzle ORM is the query layer, these
migrations are the DDL source of truth. There is no auto-diff between them.

## One-time baseline (do this before the first real migration)

The production DB already contains every table, so the first migration is a faithful dump of
the live schema, recorded as already-applied in prod rather than re-run.

1. Dump the live public schema (needs `pg_dump` matching Neon's Postgres major version):
   ```bash
   pg_dump --schema-only --schema=public --no-owner --no-privileges \
     "$DATABASE_URL" > /tmp/baseline.sql
   ```
   `--schema=public` excludes Drizzle's old `drizzle.__drizzle_migrations` bookkeeping.
2. Scaffold the migration and paste the DDL into its `-- Up Migration` section, stripping
   pg_dump noise (`\connect`, ownership, GRANTs). Ensure objects land in `public` (keep an
   explicit `SET search_path TO public;` at the top if the dump blanked it). The
   `-- Down Migration` can be a full `DROP` set or left empty with a comment — the baseline is
   never expected to roll back in prod.
   ```bash
   npm run db:migrate:create -- initial-baseline
   ```
3. **Mark it applied in prod without running the DDL** (prod already has these objects):
   ```bash
   npm run db:migrate -- --fake
   ```
   `--fake` records all currently-pending migrations as run without executing them. Only run
   this against prod while `initial-baseline` is the sole pending migration.

On a **fresh / local** DB, run `npm run db:migrate` normally (no `--fake`): node-pg-migrate
creates its `pgmigrations` table and executes the baseline, reproducing prod exactly.
