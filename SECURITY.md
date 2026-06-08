# Security Policy

## Reporting a vulnerability

Please report security issues privately to the repository maintainer
(**@mohammedsufiyandeveloper**) rather than opening a public issue. Include
steps to reproduce and the potential impact. You'll receive an acknowledgement
and a remediation timeline.

## Secret handling

- **Never commit real secrets.** Only `.env.example` files are tracked; all
  `.env*` files are git-ignored (`.env.example` is the sole exception).
- Backend secrets live in `apps/backend/.env`; mobile only stores **public**
  `EXPO_PUBLIC_*` values in `apps/mobile/.env`.
- `apps/mobile/google-services.json` is a **client** Firebase config and is
  safe to ship in the app bundle. Do **not** add any server service-account
  JSON to the repo.
- In CI and Vercel, provide secrets via the platform's encrypted
  environment/secret store — never in source. Ordinary CI checks
  (typecheck/lint/test/build) require **no** production secrets.

## History status

At migration time, the backend `.env` was confirmed **never committed**
(`git log --all -- .env` was empty), so no Git history rewrite was required.
The mobile history contained a tracked `.env` with only public
`EXPO_PUBLIC_PUSHER_*` values. Recovery bundles of the pre-migration history
are stored locally outside Git (`_backup/`, git-ignored).

## Credential rotation checklist

Because the repository changed hands/remotes, **rotate all backend
credentials** as a precaution. Rotate in each provider's console, then update
`apps/backend/.env` locally and the Vercel project's environment variables.
**Do not paste real values into commits, issues, logs, or docs.**

| Credential | Where used | Action |
| --- | --- | --- |
| `BETTER_AUTH_SECRET` | better-auth session signing | Regenerate (`openssl rand -base64 32`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth | Rotate in Google Cloud Console; update redirect URIs |
| `DATABASE_URL` / `DIRECT_URL` | PostgreSQL | Rotate DB password / connection credentials |
| `PUSHER_APP_ID` / `PUSHER_SECRET` | Pusher (server) | Rotate app secret in Pusher dashboard |
| `NEXT_PUBLIC_PUSHER_KEY` / `_CLUSTER` | Pusher (public) | Public; rotate only if the app is recreated |
| `SMTP_USER` / `SMTP_PASSWORD` | Email (nodemailer) | Rotate SMTP credentials |
| `GOOGLE_GENAI_API_KEY` | Google Generative AI | Rotate API key in Google AI Studio |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | S3 object storage | Rotate IAM keys; review bucket policy |
| `CRON_SECRET` | scheduled HTTP endpoints | Regenerate shared secret |
| Firebase `google-services.json` | mobile client config | Client-safe; rotate only if you consider it sensitive |

After rotating: redeploy the backend (Vercel) and rebuild the mobile app if any
`EXPO_PUBLIC_*` value changed.

## Supported versions

This is an actively developed application; only the `main` branch is supported.
