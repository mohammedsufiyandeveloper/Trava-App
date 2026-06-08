# Trava-App

A workspace/project-management platform with a TypeScript backend and a React
Native (Expo) mobile client, organized as a single **pnpm monorepo**.

- **Backend** — [Hono](https://hono.dev) API, [Prisma](https://www.prisma.io)
  ORM over PostgreSQL, [better-auth](https://www.better-auth.com) for
  authentication, deployed to **Vercel** functions.
- **Mobile** — [Expo](https://expo.dev) / React Native app (SDK 54, RN 0.81)
  with React Navigation, Pusher realtime, and push notifications.

---

## Architecture

```
                ┌──────────────────────┐         ┌───────────────────────┐
                │  Mobile (Expo / RN)  │  HTTPS  │  Backend (Hono API)   │
                │  apps/mobile         │ ──────► │  apps/backend         │
                │  React Navigation    │         │  Hono routes/actions  │
                │  Pusher (realtime)   │ ◄────── │  better-auth          │
                └──────────────────────┘  push   │  Prisma → PostgreSQL  │
                                                  │  S3, SMTP, Pusher,    │
                                                  │  Google GenAI         │
                                                  └───────────────────────┘
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detail.

## Repository structure

```
.
├── apps/
│   ├── backend/                 # Hono + Prisma API (Vercel)
│   │   ├── api/                 # tsup build output served by Vercel (tracked)
│   │   ├── prisma/              # schema, migrations, seed, manual sql/
│   │   ├── scripts/             # operational DB scripts (see scripts/README.md)
│   │   ├── src/
│   │   │   ├── hono/            # HTTP routes (entry: src/index.ts)
│   │   │   ├── actions/         # write operations / business logic
│   │   │   ├── data/            # read/query layer
│   │   │   ├── server/services/ # service layer
│   │   │   ├── lib/             # auth, db, audit, realtime, helpers
│   │   │   └── tests/setup.ts   # vitest global mocks
│   │   ├── vercel.json          # Vercel config (root dir = apps/backend)
│   │   └── package.json
│   └── mobile/                  # Expo React Native app
│       ├── src/{screens,components,navigation,context,services,...}
│       └── package.json
├── docs/                        # architecture, deployment, tech debt, history
├── .github/workflows/ci.yml     # backend + mobile CI
├── pnpm-workspace.yaml
└── package.json                 # workspace root scripts
```

## Prerequisites

- **Node 20** (see [`.nvmrc`](.nvmrc); `nvm use`)
- **pnpm 10** (`corepack enable` or `npm i -g pnpm`)
- **PostgreSQL** database (for the backend)
- For mobile: the [Expo](https://docs.expo.dev/get-started/installation/)
  toolchain; Xcode / Android Studio for native builds.

## Environment setup

Copy the example env files and fill in real values (never commit `.env`):

```bash
cp apps/backend/.env.example apps/backend/.env
cp apps/mobile/.env.example  apps/mobile/.env
```

Backend env keys are documented in
[`apps/backend/.env.example`](apps/backend/.env.example) (auth, database,
Pusher, SMTP, AWS/S3, Google OAuth & GenAI). Mobile only needs the public
`EXPO_PUBLIC_PUSHER_*` keys. See [SECURITY.md](SECURITY.md) for credential
handling and rotation.

## Install

```bash
pnpm install          # installs both workspaces; generates Prisma client
```

## Local development

```bash
pnpm dev:backend      # Hono dev server (tsx watch) on PORT (default 3000)
pnpm dev:mobile       # expo start
```

The mobile app's API base URL is set in
`apps/mobile/src/services/api.ts` (`API_BASE`). Point it at your local backend
for end-to-end testing.

## Database commands (backend)

```bash
pnpm --filter @trava/backend db:migrate   # prisma migrate dev
pnpm --filter @trava/backend db:push      # prisma db push
pnpm --filter @trava/backend db:studio    # prisma studio
pnpm --filter @trava/backend db:seed      # seed units
```

Migrations live in `apps/backend/prisma/migrations/`. Manual, non-Prisma SQL
scripts are documented in `apps/backend/prisma/sql/README.md`.

## Testing, linting, type-checking

Run from the repo root:

```bash
pnpm typecheck        # tsc --noEmit (both apps)
pnpm lint             # eslint (both apps)
pnpm test             # vitest (backend)
pnpm build            # backend production build (tsup → apps/backend/api)
pnpm verify           # typecheck + lint + test + build
```

CI runs the same checks and **requires no production secrets** (the backend
test suite mocks Prisma and external services).

## Build & deployment

The backend deploys to **Vercel**. The Vercel project's **Root Directory** must
be set to `apps/backend`; the build command (`pnpm run build`) regenerates the
`api/` bundle that Vercel serves. See
[docs/DEPLOYMENT_CHECKLIST.md](docs/DEPLOYMENT_CHECKLIST.md).

The mobile app builds with **EAS** (`apps/mobile/eas.json`):

```bash
cd apps/mobile && eas build
```

## Contributing & security

- [CONTRIBUTING.md](CONTRIBUTING.md) — workflow, conventions, commit style.
- [SECURITY.md](SECURITY.md) — reporting, secret handling, rotation checklist.
- [docs/TECH_DEBT.md](docs/TECH_DEBT.md) — known issues and refactoring plan.

## License

Licensed under the [Apache License 2.0](LICENSE).
