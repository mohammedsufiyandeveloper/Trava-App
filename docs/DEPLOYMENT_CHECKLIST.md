# Deployment Checklist

## Backend (Vercel)

### One-time project setup

- [ ] Create/connect the Vercel project to the GitHub repo.
- [ ] **Set Root Directory = `apps/backend`** (Project Settings → General).
      The monorepo build only works with this set.
- [ ] Confirm build settings match `apps/backend/vercel.json`:
      - Install: `pnpm install`
      - Build: `pnpm run build` (runs `prisma generate` + a single-file
        `tsup` bundle → `api/index.js`; keep code splitting disabled so the
        Vercel Hobby plan sees one Serverless Function)
      - Region: `bom1`
- [ ] Add **environment variables** (rotated values — see
      [SECURITY.md](../SECURITY.md)) for all keys in
      `apps/backend/.env.example`:
      auth, `DATABASE_URL`/`DIRECT_URL`, Pusher, SMTP, AWS/S3, Google
      OAuth + GenAI, `CRON_SECRET`.
- [ ] Configure Google OAuth redirect URIs to match `BETTER_AUTH_URL`.

### Each deploy

- [ ] `pnpm verify` passes locally and CI is green on the commit.
- [ ] Database migrations applied:
      `pnpm --filter @trava/backend exec prisma migrate deploy`
      (run against the production DB with the proper `DATABASE_URL`/`DIRECT_URL`).
- [ ] Any manual `prisma/sql/` scripts reviewed and applied if needed.
- [ ] Deploy (push to `main` or trigger Vercel).
- [ ] Smoke-test a protected route (auth), a DB read, and a realtime event.

## Mobile (Expo / EAS)

- [ ] `EXPO_PUBLIC_PUSHER_*` env values set for the build profile.
- [ ] `API_BASE` in `src/services/api.ts` points at the production backend.
- [ ] `app.json` version / build numbers bumped.
- [ ] Expo/EAS project owner + project ID correct for the publishing account.
- [ ] `google-services.json` present (client config).
- [ ] `cd apps/mobile && eas build` for the target platform(s).
- [ ] Submit to store / distribute via EAS as appropriate.

## Post-deploy

- [ ] Verify push notifications deliver (Expo).
- [ ] Verify Pusher realtime channels.
- [ ] Confirm no secrets leaked into logs.
- [ ] Tag the release.

## Rollback

- Backend: redeploy the previous Vercel deployment; if a migration must be
  reverted, restore from DB backup (Prisma migrations are not auto-reverted).
- Mobile: ship the previous build / OTA update.
