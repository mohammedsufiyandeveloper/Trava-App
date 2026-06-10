# Travis — In-app AI Assistant

Travis is the Trava workspace assistant. It answers questions from live workspace
data and can propose changes (tasks, subtasks, daily reports, leave, indents) that
the user explicitly confirms before anything is written.

## Architecture

```
Mobile AIScreen ──► POST /api/ai/chat ──► TravisService.runTurn
                                              │
        resolveTravisContext (auth, role, accessible project IDs, tz)
                                              │
                       Gemini (function calling)  ◄── cached tool declarations
                                              │
                              Tool Registry (single execution path)
                       ┌──────────────┴───────────────┐
                  READ tools (auto)            WRITE tools (preview only)
                  strict project scope         buildPreview → signed token
                                              │
Mobile confirm  ──► POST /api/ai/confirm ──► TravisService.executeConfirmed
                       verify token → idempotency → runConfirmedWrite
                       → existing app services/actions (TasksService, LeaveService, …)
```

Key backend modules (under `apps/backend/src/server/travis/`):

- `contract.ts` — typed request + structured event stream (Zod).
- `context.ts` — permission-aware context resolver (deny = `null`).
- `tools/registry.ts` — registers tools; the only place tools execute; enforces
  policy → arg validation → timeout → audit.
- `tools/read-tools.ts` — project-scoped read and non-mutating draft tools.
- `tools/write-tools.ts` — confirmation-gated mutation tools that reuse existing services.
- `tools/nav-tool.ts` — `navigate_to_entity` (verified deep-link).
- `confirmation.ts` — HMAC-signed, 5-minute, user+workspace-bound tokens.
- `idempotency.ts` — at-most-once confirmed writes (Prisma + in-memory fallback).
- `persistence.ts` — conversation history (guarded; no-op until migrated).
- `services/travis.service.ts` — turn orchestration + confirmation execution.

## Security guarantees

- Unauthenticated requests are rejected (401); non-members rejected (403).
- Every read is scoped to the caller's **accessible project IDs**; admins see the
  whole workspace, others only their project memberships. Leave is admin-only for
  team-wide views.
- Model-supplied IDs are always re-resolved and re-scoped server-side — a fabricated
  or out-of-scope id is rejected.
- Writes never execute from a model response. They require a signed confirmation
  token that is tamper-resistant (HMAC over the payload), short-lived (5 min), and
  bound to the user + workspace.
- Confirmed writes atomically claim a unique database key before mutation, so
  concurrent confirmations across serverless instances cannot both execute.
- Conversation context is loaded from server-owned history. Client-supplied
  assistant messages are not trusted as model context.
- Tool results and stored content (descriptions, comments, reports) are treated as
  untrusted data; the system prompt forbids following instructions found inside them.
- Write/destructive attempts (success and failure) are recorded via `recordActivity`.

## Required environment variables

| Variable | Purpose |
|---|---|
| `GOOGLE_GENAI_API_KEY` | Gemini API key (required for Travis to answer). |
| `GEMINI_MODEL` | Model id (default `gemini-2.5-flash`). |
| `BETTER_AUTH_SECRET` | Already required; also signs Travis confirmation tokens. |
| `DATABASE_URL` / `DIRECT_URL` | Postgres (existing). |

No new secrets are introduced. Nothing is logged in production beyond request ids.

## Database migration (authored, NOT applied)

A migration adds three tables: `travisIdempotency`, `travisConversation`,
`travisMessage`. Read-only Travis runs without them, but production write
confirmations remain disabled until this migration is applied. This avoids
unsafe per-instance idempotency on serverless deployments:

```bash
# From apps/backend, against the target database:
pnpm prisma migrate deploy          # applies prisma/migrations/*_add_travis_tables
pnpm prisma generate                # already run by the build
```

Rollback: drop the three tables (and the `travisMessage_conversationId_fkey`
constraint). No existing tables/columns are modified, so rollback is isolated.

> Do not run `migrate deploy` against production without approval.

## Mobile testing checklist (real device)

1. Open Travis from the radial menu / Home. Header shows **Travis** + workspace.
2. "What should I focus on today?" → text answer (no tool errors).
3. "Show overdue tasks" → task **cards**; tapping a card opens TaskDetail.
4. "Create a task for tomorrow in <project>" → **confirmation preview** appears;
   nothing is created yet.
5. Tap **Confirm** → success message + card + "Open" navigates to the new task.
   Verify exactly one task was created.
6. Repeat the same create and tap **Cancel** / **Edit** → no task created.
7. As a non-admin, ask about another project's tasks → scoped out (not shown).
8. Turn off network → friendly offline message; **Retry** works.
9. Unset `GOOGLE_GENAI_API_KEY` on a test backend → provider-unavailable UI.
10. Send a message, then immediately **Stop** → request cancels; leaving the screen
    cancels in-flight requests.

## Known limitations

- Responses are non-streaming (single structured envelope). The contract and UI are
  streaming-ready (`text_delta`); switch the transport to SSE when desired.
- Confirmation arguments are carried in a signed request token. Tool schemas
  strictly bound their size, and the API accepts tokens up to 128 KB.
- Leave and daily-report drafts are text-only and are never persisted. Indents
  support a real persisted `DRAFT` state.
- Conversation persistence and production write confirmations require the migration.
- Rate limiting is per-instance in-memory (20/min/user). Use a shared store for
  multi-instance exactness.
- Travis answers require a valid `GOOGLE_GENAI_API_KEY`; without it the provider
  fallback UI is shown.
