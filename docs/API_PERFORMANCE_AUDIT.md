# Trava API Performance Audit

Status: **Phase 4 complete · growing collections paginated, real tagged cache foundation implemented, access checks tightened, and request/auth/DB timing available · production benchmarks blocked on staging credentials**
Scope: every API used by the Trava mobile app (`apps/backend` + `apps/mobile/src/services/api.ts`).
Method: static source analysis with file:line evidence. No production DB or secrets were accessed.

> ⚠️ **What this audit does NOT contain yet, and why.** Phases that require a live/staging
> Postgres or deployed environment — `EXPLAIN (ANALYZE, BUFFERS)`, `pg_stat_statements`,
> real warm/cold latency benchmarks, and Vercel-region / pooled-`DATABASE_URL` verification —
> are **not executed here** because they require database credentials and a running instance,
> which this environment cannot safely provide. Those sections list the exact commands/queries
> to run once credentials are available, rather than fabricated numbers.

---

## 1. Endpoint inventory

Mounted under `basePath("/api")` in `src/hono/index.ts`. Auth: `authMiddleware` applied to all routes except `/health`, `/cron/*`, and `/auth/*`.

| Method | Path | Route file | Primary data fn | Mobile caller (api.ts) | Notes |
|---|---|---|---|---|---|
| GET | /projects | routes/projects.ts:17 | `getUserProjects` | `getProjects` (239) | **lite ignored (fixed)** |
| GET | /projects?projectId | routes/projects.ts:21 | `prisma.project.findUnique` | `getProject` (273) | full include, member arrays |
| POST/PATCH/DELETE | /projects | projects.ts:112/167/189 | project actions | create/update/delete | — |
| GET/POST/PATCH/DELETE | /projects/:id/members | projects.ts:214+ | member actions | members CRUD | — |
| GET | /tasks | routes/tasks.ts | `getTasks` | `getTasks` | view-aware limits and projections |
| GET | /tasks/kanban | routes/tasks.ts | `getKanbanBoard` | `getKanbanBoard` | one initial board request |
| GET | /tasks/count | routes/tasks.ts:88 | count query | `getTasksCount` (476) | separate count request |
| GET | /tasks/:id | tasks.ts:358 | task fetch | `getTaskById` (541) | — |
| GET | /tasks/:id/subtasks | tasks.ts:397 | subtasks | `getSubTasks` (519) | — |
| GET | /tasks/:id/comments | tasks.ts | comments | `getTaskComments` | cursor-paginated |
| GET | /tasks/:id/activities | tasks.ts | activities | `getTaskActivities` | cursor-paginated |
| POST/PATCH/DELETE | /tasks | tasks.ts:155/214/311 | task actions | create/update/delete | — |
| PATCH | /tasks/:id/assignee | tasks.ts:652 | assignee | — | — |
| GET | /workspace(s) | routes/workspace.ts:9 | `getWorkspaces` | workspace startup | — |
| GET | /workspace/settings, /:id/members | workspace.ts:24/55 | metadata/members | settings/members | — |
| GET | /tags | routes/tags.ts:11 | tags | `getTags` | reference data |
| GET | /notifications | routes/notifications.ts:124 | notifications | `getNotifications` | — |
| GET/POST | /conversations(+/:id/messages) | routes/conversations.ts | conversations | chat | — |
| GET/POST | /attendance(+today/register/check-in/out) | routes/attendance.ts | attendance | attendance | — |
| GET/POST/PATCH | /leaves(+/balance) | routes/leaves.ts | leaves | leave mgmt | — |
| GET/POST/PATCH/DELETE | /procurement/* | routes/procurement.ts | procurement | procurement | — |
| GET/PATCH/POST | /user/profile, /push-token | routes/user.ts | profile | profile | — |
| GET | /activities | routes/activities.ts:130 | activity feed | — | — |
| GET/POST | /myspace | routes/myspace.ts | board | My Space | — |
| GET/POST/... | /units | routes/units.ts | units | procurement units | — |
| POST | /ai | routes/ai.ts:60 | TravisService | AI chat | in-memory rate-limit map |
| GET | /cron/auto-absence, /keep-warm | routes/cron.ts | cron | (scheduler) | unauthenticated by design |
| ALL | /auth/* | index.ts:99 | Better Auth | sign-in/session | — |

Mobile client makes **78** `apiFetch(...)` calls (`api.ts`). Dead/duplicate routes: `/workspace` and `/workspaces` both mount the same router (index.ts:153-154) — intentional alias, low risk.

---

## 2. Verified findings (evidence-backed)

| # | Severity | Finding | Evidence |
|---|---|---|---|
| F1 | **High** | `GET /projects` ignored `?lite=true`; mobile always received the heavy payload (per-project `projectMembers` array with user objects incl. **emails** + `_count`). | Route called `getUserProjects(workspaceId)` with no lite arg (projects.ts:100). Mobile sends `&lite=true` (api.ts:241) from 3 `WorkspaceContext` call sites (123/197/255). `getUserProjects` already supported `lite` (get-projects.ts:202). |
| F2 | **High** | `GET /tasks` default page size **500**, no NaN guard or upper clamp. | tasks.ts:39 (`: 500`). |
| F3 | **High** | Core workspace/project/tag/permission cache wrappers were no-ops. **Core mobile paths fixed in Phase 4.** | Shared bounded runtime cache now supports TTL, in-flight de-duplication, tag eviction, and optional Upstash REST distribution. Legacy web-only data modules remain listed for later migration. |
| F4 | **High** | **Kanban request storm**: per-status fetch, 6 statuses, each `getTasks` + count via `Promise.all` ⇒ up to 12 requests per board load (more on refresh). | MyBoardScreen.tsx:101 (`KANBAN_STATUSES` ×6), `fetchKanbanColumn` (304) `Promise.all([getTasks, count])` (333). |
| F5 | **Med** | **Task detail fan-out**: 4 separate requests (task, subtasks, comments, activities) for the initial view; comments/activities unpaginated. **Fixed in Phase 3.** | Replaced with `GET /tasks/:id/detail`; legacy collection endpoints now use bounded cursor pages. |
| F6 | **Med** | **Separate count requests** alongside every task/kanban page. | api.ts `getTasksCount` (476); MyBoard `Promise.all([getTasks, count])`. |
| F7 | **Med** | **Auth did up to 2 session lookups/request** for mobile. **Fixed in Phase 3.** | Bearer clients now use one `Session.token` `findUnique`; browser cookie clients continue through Better Auth. |
| F10 | **High** | Workspace startup issued 4–5 authenticated requests after token lookup. **Fixed in Phase 3.** | `GET /workspaces/bootstrap` returns workspace shell, lite projects, tags, personal attendance, and role-appropriate team attendance in one request. |
| F11 | **Med** | Direct-message history was unbounded and became slower as conversations grew. **Fixed in Phase 3.** | Messages now use a 30-row cursor page (hard max 50); mobile loads older messages at scroll end. |
| F12 | **High** | Procurement indents and leave histories loaded every record. **Fixed in Phase 4.** | Both use 25-row cursor pages (hard max 50) and mobile incremental loading. |
| F13 | **Med** | Project-member reads required authentication but did not verify project access. **Fixed in Phase 4.** | Member data is returned only to workspace admins or direct project members. |
| F8 | Low | Obsolete `isPinned`/`pinnedAt` removed from schema but referenced in types/comments (kept as optional stubs). No live `assigneeTo` references found. | legacy-types.ts:6/24; get-tasks.ts:31; pin-subtask.ts:15. Not a live SQL bug. |
| F9 | Low | `/projects?projectId` full include returns member emails + nested `clint.clintMembers` even when not needed. | projects.ts:24-49. |

---

## 3. Implemented and contract-verified

Backend and mobile typecheck clean. The backend suite now contains **101 tests**.

### Fix F1 — honor `lite=true` (payload reduction, no UX regression)
- `routes/projects.ts`: read `?lite=true` and pass to `getUserProjects(workspaceId, lite)`.
- `data/project/get-projects.ts`: the lite projection now returns `{ id, workspaceId, name, slug, color, description }` — **drops** the heavy `projectMembers[]` (with per-member `user{...email}`) and `_count`.
- **Safety proof:** the only lite-list consumers are `WorkspaceContext` (reads none of the dropped fields) and `ProjectsScreen` (renders `item.description`, now preserved). `ProjectKanban` and `EditProjectModal` read `projectMembers`/managers from the **separate full** `getProject(projectId)` endpoint (ProjectKanban.tsx:143, api.ts:273) — unchanged.
- **Expected effect:** large drop in `/projects?lite=true` payload (eliminates N member-objects + emails per project). Exact KB delta to be measured (see §5).

### Fix F2 — view-aware pagination
- Default limits: list/default/search/subtask `25`, Kanban `10`, calendar `50`, Gantt `150`.
- Hard maximum: `200`; invalid, zero, negative, and NaN values fall back to the view default.
- Mobile workflows that intentionally load larger collections now send explicit limits.
- Repeated `projectId` query parameters are preserved instead of silently using only the first project.

### Fix F4 — consolidated workspace Kanban
- Added `GET /api/tasks/kanban`.
- Initial load and pull-to-refresh now use one authenticated HTTP request instead of approximately 12 requests for admins and up to 18 for project managers.
- The backend resolves permissions once, executes one grouped count, and performs one bounded first-page query per status.
- Per-column load-more remains one targeted cursor request through `GET /api/tasks`.

### View-specific task DTOs
- `view_mode` is validated and propagated by `GET /api/tasks`.
- List/Kanban/Gantt rows no longer include task descriptions or creator relations.
- Gantt rows omit tags, aggregate counts, reviewers, and repeated project-manager data.
- List/Kanban task project metadata includes only project managers/leads, without email addresses, instead of every project member.

### Phase 3 — task-detail bootstrap and bounded collections
- Added `GET /api/tasks/:taskId/detail`.
- Initial task detail now uses one HTTP request instead of task + subtasks + comments + activities.
- The bootstrap returns bounded first pages: 30 subtasks, 20 comments, and 20 activities.
- `GET /tasks/:id/comments` and `/activities` now expose cursor pagination with a hard maximum of 50.
- Task detail, comments, and activity reads enforce workspace membership.
- Mobile includes a compatibility fallback for staggered backend/app deployments.

### Phase 3 — workspace startup bootstrap
- Added `GET /api/workspaces/bootstrap`.
- Normal app launch now loads workspaces, selected workspace, lite projects, tags, personal attendance, and admin team attendance through one authenticated HTTP request.
- Independent database reads run concurrently after the selected workspace is resolved.
- Mobile retains the previous parallel request path only as a rolling-deployment fallback.

### Phase 3 — bearer auth fast path
- Mobile bearer tokens now resolve through one indexed `session.findUnique({ token })` lookup.
- Cookie clients continue to use Better Auth.
- Expired bearer sessions return `401` without a redundant cookie-session lookup.

### Phase 3 — chat and notification growth controls
- Direct-message history uses cursor pagination: default 30, hard maximum 50.
- The inverted chat list incrementally appends older pages and de-duplicates real-time messages.
- Notification limits are validated and clamped to 50.
- Notification rows and unread count execute concurrently; `hasMore` uses an extra-row check.

### Phase 3 — production diagnostics
- Every response includes `x-request-id` and `Server-Timing: app;dur=...`.
- CORS exposes both diagnostics headers.
- Authenticated responses default to `Cache-Control: private, no-store`.
- Verbose request and per-task mapping logs are development-only on mobile.

### Phase 4 — procurement and leave pagination
- Indents and leave requests use cursor pagination: default 25, hard maximum 50.
- Procurement, Leave, and Admin Leave screens load older pages near scroll end and de-duplicate rows.
- Indent and leave search runs server-side inside the paginated query, so older matches remain discoverable.
- Pull-to-refresh and mutations reset to the newest page.
- Added a workspace-scoped exact indent read; Indent Detail no longer downloads all indents and searches client-side.

### Phase 4 — real tagged cache foundation
- Added a shared cache with TTL, a 500-entry in-process bound, concurrent miss de-duplication, exact-key eviction, and tag eviction.
- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` enable cross-instance distributed storage without changing callers.
- Cache failures fall back to the database and never fail application reads.
- Distributed serialization preserves nested `Date` values and server-side data contracts.
- Workspaces, workspace detail/members, projects, project members, tags, and permission checks now use the shared cache.
- Existing workspace/project/tag/member/permission mutation invalidators now perform and await real tag eviction.
- Project-member caches are populated only after authorization succeeds.
- Workspace member role filters and tag reads verify workspace membership before returning data.

### Phase 4 — deeper timing
- `Server-Timing` includes total application and authentication duration.
- Setting `ENABLE_DB_TIMING=true` adds aggregate Prisma query count and cumulative DB duration.
- SQL, query parameters, tokens, and response bodies are never included in timing headers.

### Deterministic payload fixture

Run:

```bash
node apps/backend/scripts/measure-task-payload.mjs
```

Representative Kanban payload with a 20-member project:

| Tasks | Previous bytes | Optimized bytes | Reduction |
|---:|---:|---:|---:|
| 1 | 4,286 | 703 | 83.6% |
| 15 | 64,291 | 10,541 | 83.6% |
| 100 | 428,771 | 70,381 | 83.6% |

These are fixture serialization measurements, not production latency claims.

---

## 4. Remaining implementation steps (prioritized)

Following the requested delivery order; each needs its own verification.

1. **Configure distributed cache in staging/production** — provide the two Upstash REST variables; local and credential-free deployments retain bounded memory caching.
2. **Migrate legacy web-only no-op wrappers** — daily reports, board helpers, legacy task loaders, and older procurement helpers are not on the main mobile request path but should move to the shared adapter.
3. **Notification legacy enrichment** — remove read-time audit fallback queries after legacy rows have been backfilled.
4. **DB indexes** — add only migrations supported by staging `EXPLAIN (ANALYZE, BUFFERS)` evidence.

---

## 5. Runtime-dependent work (blocked — needs DB/staging credentials)

Run these once a safe staging DB + deployed instance are available; record results in `docs/` before/after:

- Enable `ENABLE_DB_TIMING=true` in staging and capture the implemented app/auth/DB timing. Serialization time and exact response bytes still require a staging-safe measurement pass.
- **Benchmarks** (warm/cold p50/p95/p99, error rate, request count, payload bytes) for: sign-in/session, workspace startup, projects, list tasks, filtered tasks, kanban, gantt, task detail, attendance, notifications, conversations, procurement.
- **`EXPLAIN (ANALYZE, BUFFERS)`** on the heavy queries; inspect `pg_stat_statements`, index usage, seq scans, fan-out.
- **Verify** `DATABASE_URL` is the **pooled** connection and the DB region is co-located with Vercel `bom1`.

---

## 6. Performance targets (from brief)
cached/reference reads p95 < 200 ms · normal DB reads p95 < 400 ms · complex task queries p95 < 600 ms · workspace usable < 1 s · **Kanban 1–2 requests (not 12–18)** · task-detail 1–2 requests · typical list payloads < 100–150 KB · no unpaginated growing collections · error rate < 0.5%.

## 7. Rollback
No migrations or data changes were introduced. Phase 3 remains compatible with
older app/backend versions through mobile fallback paths. Roll back the backend
and mobile integration together through the normal Vercel/app release process.
