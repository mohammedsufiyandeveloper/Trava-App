# Contributing to Trava-App

Thanks for contributing! This is a pnpm monorepo with two workspaces:
`apps/backend` (Hono/Prisma) and `apps/mobile` (Expo/React Native).

## Getting started

1. Install **Node 20** (`nvm use`) and **pnpm 10** (`corepack enable`).
2. `pnpm install` at the repo root.
3. Copy env files: `cp apps/backend/.env.example apps/backend/.env` and
   `cp apps/mobile/.env.example apps/mobile/.env`, then fill in values.
4. See [README.md](README.md) for dev/test commands.

## Workflow

- Branch off `main`: `git checkout -b feat/short-description`.
- Keep changes focused; avoid unrelated refactors in the same PR.
- Before pushing, run `pnpm verify` (typecheck + lint + test + build).
- Open a PR against `main`. CI (`.github/workflows/ci.yml`) must pass.
- `main` is protected; PRs require review (see `.github/CODEOWNERS`).

## Code conventions

- **TypeScript** everywhere. Prefer explicit types on public/module
  boundaries; avoid `any` (existing `any` usage is tracked in
  [docs/TECH_DEBT.md](docs/TECH_DEBT.md) — don't add more).
- **Backend**: routes in `src/hono/routes`, writes in `src/actions`, reads in
  `src/data`, shared logic in `src/lib`. Access the database via
  `@/lib/db`.
- **Mobile**: screens in `src/screens`, shared UI in `src/components`,
  navigation in `src/navigation`, API access in `src/services/api.ts`.
- Match the surrounding file's style (indentation, naming, imports).
- Lint must pass with **zero errors**; warnings are acceptable but don't add
  new ones gratuitously.

## Tests

- Backend tests use **vitest** with global mocks in
  `apps/backend/src/tests/setup.ts` (Prisma and external services are mocked —
  tests never hit a real database or network).
- Add tests for new actions/routes, especially security-sensitive ones
  (auth, membership, project/task mutations).
- To test a module that the global setup mocks, `vi.unmock(...)` it at the top
  of your test file (see `src/lib/auth/__tests__/require-user.test.ts`).

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org):

```
feat(mobile): add procurement indent screen
fix(backend): correct ProjectRole enum handling
chore(ci): cache pnpm store
```

## Database changes

- Edit `apps/backend/prisma/schema.prisma`, then
  `pnpm --filter @trava/backend db:migrate` to create a migration.
- Never hand-place loose `.sql` files in `prisma/migrations/`; put manual
  operational SQL in `prisma/sql/` (see its README).

## Secrets

Never commit real credentials. Only `.env.example` files are tracked. See
[SECURITY.md](SECURITY.md).
