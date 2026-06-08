# Backend operational scripts

One-off and maintenance scripts for database inspection, migration assistance,
and diagnostics. Run with `tsx` from `apps/backend`, e.g.:

```bash
pnpm --filter @trava/backend exec tsx scripts/<name>.ts
```

All scripts read `DATABASE_URL` / `DIRECT_URL` from the backend `.env`. They
operate on **live data** — review before running, and prefer a non-production
database when possible.

## Categories

- **Diagnostics / connection**: `diagnose-db-connection.ts`,
  `test-db-connection.ts`, `full-diagnostic.ts`, `list-tables.ts`.
- **Inspection**: `inspect-task.ts`, `check-data.ts`, `check-task-cols.ts`,
  `check-all-cols.ts`, `check-case.ts`, `check-sql-pos.ts`, `check-wm.ts`,
  `find-all-fks.ts`, `find-constraints.ts`, `test-query.ts`.
- **Migrations / data ops**: `run-migration.ts`, `run-safe-migration.ts`,
  `migrate-direct.ts`, `migrate-data.ts`, `migrate-blocked-to-cancelled.ts`,
  `verify-migration.ts`, `delete-all-indents.ts`.
- **Performance**: `measure-workspace-load.ts`, `verify-pagination.ts`.
- **Windows helper**: `setup-db.ps1`.

> Ad-hoc throwaway investigation scripts (e.g. one-off lookups tied to specific
> records) live in the git-ignored `apps/backend/dev/` folder, not here.
