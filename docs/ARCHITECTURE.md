# Architecture

## Overview

Trava-App is a pnpm monorepo with two deployable apps:

- `apps/backend` — a [Hono](https://hono.dev) HTTP API on Node 20, persisting to
  PostgreSQL via [Prisma](https://www.prisma.io), authenticated with
  [better-auth](https://www.better-auth.com), deployed as **Vercel** functions.
- `apps/mobile` — an [Expo](https://expo.dev) React Native client.

They communicate over HTTPS (REST-style routes) plus **Pusher** for realtime
updates and **Expo push notifications** for mobile alerts.

## Backend

### Entry points

- `src/index.ts` — the Hono app exported for the Vercel/serverless build
  (`tsup` bundles it into `api/`).
- `src/server.ts` — a standalone `@hono/node-server` used for local dev
  (`pnpm dev:backend`) on `PORT` (default 3000).
- `src/hono/index.ts` — mounts all route modules under their paths
  (`/tasks`, `/projects`, `/workspace`, `/attendance`, `/ai`, `/notifications`,
  `/procurement`, `/cron`, …).

### Layering

| Layer | Location | Responsibility |
| --- | --- | --- |
| Routes | `src/hono/routes` | HTTP handlers, request/response shape |
| Actions | `src/actions` | Write operations / business logic |
| Data | `src/data` | Read/query layer (Prisma queries) |
| Services | `src/server/services` | Cross-cutting service logic |
| Lib | `src/lib` | `db` (Prisma client), `auth`, `audit`, `realtime`, cache, helpers |

### Authentication

`src/lib/auth` configures better-auth. Within the Hono request lifecycle, the
authenticated user is stored in an `AsyncLocalStorage` context
(`src/lib/auth/require-user.ts`); `requireUser()` reads it and throws
`Unauthorized` when absent. This is the primary auth guard and is unit-tested.

### Data store

PostgreSQL via Prisma (`prisma/schema.prisma`). The generated client is emitted
to the default `@prisma/client` location (the `@/generated/prisma` alias is
legacy and unused). Migrations are under `prisma/migrations/`; manual
operational SQL is documented under `prisma/sql/`.

### External integrations

- **AWS S3** — object/image storage (`@aws-sdk/client-s3`, presigned URLs).
- **SMTP** — transactional email (`nodemailer`).
- **Pusher** — realtime channel broadcasts.
- **Google Generative AI** — AI features (`@google/generative-ai`).
- **Expo Server SDK** — push notifications.

## Mobile

- **Navigation** — React Navigation (native-stack + bottom-tabs) in
  `src/navigation`.
- **State/context** — `src/context` (e.g. `WorkspaceContext`).
- **API access** — `src/services/api.ts` (base URL in `API_BASE`).
- **Realtime** — `pusher-js` with public `EXPO_PUBLIC_PUSHER_*` keys.
- **Screens/components** — `src/screens`, `src/components`.

## Build & deploy

- Backend: `tsup` bundles `src/index.ts` → `apps/backend/api/` (minified ESM,
  `--clean`), externalizing `@prisma/client` and `better-auth`. Vercel serves
  `api/` (root directory = `apps/backend`, see `vercel.json`).
- Mobile: Expo/EAS (`apps/mobile/eas.json`).

## CI

`.github/workflows/ci.yml` runs two jobs — backend
(typecheck/lint/test/build) and mobile (typecheck/lint) — with pnpm caching and
frozen lockfiles, requiring no production secrets.

## Known constraints

The legacy procurement/inventory backend modules reference Prisma models that
were removed in a schema refactor and are marked `@ts-nocheck` pending a rewrite
against the new `indent`/`indent_line_item`/`material_catalog`/`vendor_quote`
models. See [TECH_DEBT.md](TECH_DEBT.md).
