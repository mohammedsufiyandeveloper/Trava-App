# Manual SQL scripts

These are **operational SQL scripts** that are **not** part of Prisma's
migration history. Prisma only applies migrations that live in
`prisma/migrations/<timestamp>_<name>/migration.sql`; loose `.sql` files are
ignored. They were previously sitting loose in `prisma/migrations/`, which is
an invalid layout, so they have been moved here and documented.

The schema changes they imply are already reflected in `schema.prisma`. Run
them manually (e.g. via `psql "$DIRECT_URL" -f <file>`) only when you
understand the current state of the target database — do **not** assume they
are unapplied.

| File | Purpose | Idempotent? |
| --- | --- | --- |
| `20260406_schema_integrity_refactor.sql` | Backfills `ProjectMember` rows from `Task` history so every task creator has project membership. | Yes — guarded by `WHERE NOT EXISTS`. |
| `add_task_filtering_indexes.sql` | Adds trigram / btree performance indexes for large-scale task filtering (50k–200k+ tasks). | Verify each statement uses `IF NOT EXISTS` before running. |

If you want one of these to become a tracked migration in the future, create a
proper migration with `prisma migrate dev --create-only` and move the SQL into
the generated folder, after confirming it has not already been applied.
