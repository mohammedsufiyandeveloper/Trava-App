# Trava API Performance Audit

Status: **Phase 1 (inventory) complete · high-confidence fixes implemented · runtime/DB phases blocked on credentials**
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
| GET | /tasks | routes/tasks.ts:19 | `getTasks` | `getTasks` (388) | **default limit 500 (clamped)** |
| GET | /tasks/count | routes/tasks.ts:88 | count query | `getTasksCount` (476) | separate count request |
| GET | /tasks/:id | tasks.ts:358 | task fetch | `getTaskById` (541) | — |
| GET | /tasks/:id/subtasks | tasks.ts:397 | subtasks | `getSubTasks` (519) | — |
| GET | /tasks/:id/comments | tasks.ts:544 | comments | `getTaskComments` (556) | unpaginated |
| GET | /tasks/:id/activities | tasks.ts:724 | activities | `getTaskActivities` (570) | unpaginated |
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
| F3 | **High** | "Cache" layer is a **no-op**: `const cache = (fn) => fn` and `unstable_cache(...) => fn`. `revalidate:60` + cache tags do nothing. Spread across ≥10 data modules. | get-projects.ts:3-4; same pattern in `src/data/comments`, `src/data/board`, `src/data/workspace/*` (10+ files). |
| F4 | **High** | **Kanban request storm**: per-status fetch, 6 statuses, each `getTasks` + count via `Promise.all` ⇒ up to 12 requests per board load (more on refresh). | MyBoardScreen.tsx:101 (`KANBAN_STATUSES` ×6), `fetchKanbanColumn` (304) `Promise.all([getTasks, count])` (333). |
| F5 | **Med** | **Task detail fan-out**: 4 separate requests (task, subtasks, comments, activities) for the initial view; comments/activities unpaginated. | TaskDetailScreen.tsx:188/139/160/170; `/tasks/:id/comments` & `/activities` have no pagination params (tasks.ts:544/724). |
| F6 | **Med** | **Separate count requests** alongside every task/kanban page. | api.ts `getTasksCount` (476); MyBoard `Promise.all([getTasks, count])`. |
| F7 | **Med** | **Auth does up to 2 session lookups/request** for mobile: `auth.api.getSession` (DB-backed, cookie-oriented) runs first and fails for bearer clients, then a fallback `prisma.session.findFirst({where:{token}})`. | middleware/auth.ts:18-46. `Session.token` is `@unique` (schema:48) → fallback should use `findUnique`. |
| F8 | Low | Obsolete `isPinned`/`pinnedAt` removed from schema but referenced in types/comments (kept as optional stubs). No live `assigneeTo` references found. | legacy-types.ts:6/24; get-tasks.ts:31; pin-subtask.ts:15. Not a live SQL bug. |
| F9 | Low | `/projects?projectId` full include returns member emails + nested `clint.clintMembers` even when not needed. | projects.ts:24-49. |

---

## 3. Implemented in this pass (safe, contract-verified)

All changes typecheck clean and keep the backend test suite at **60/60**.

### Fix F1 — honor `lite=true` (payload reduction, no UX regression)
- `routes/projects.ts`: read `?lite=true` and pass to `getUserProjects(workspaceId, lite)`.
- `data/project/get-projects.ts`: the lite projection now returns `{ id, workspaceId, name, slug, color, description }` — **drops** the heavy `projectMembers[]` (with per-member `user{...email}`) and `_count`.
- **Safety proof:** the only lite-list consumers are `WorkspaceContext` (reads none of the dropped fields) and `ProjectsScreen` (renders `item.description`, now preserved). `ProjectKanban` and `EditProjectModal` read `projectMembers`/managers from the **separate full** `getProject(projectId)` endpoint (ProjectKanban.tsx:143, api.ts:273) — unchanged.
- **Expected effect:** large drop in `/projects?lite=true` payload (eliminates N member-objects + emails per project). Exact KB delta to be measured (see §5).

### Fix F2 — clamp `/tasks` page size
- `routes/tasks.ts`: NaN-guard + clamp to `[1, 500]`. Default **kept at 500** intentionally (Gantt/list currently rely on a single large page; lowering the default is a coordinated mobile-pagination change tracked for a later step). This strictly prevents abusive/accidental huge fetches without altering any valid existing call.

---

## 4. Recommended next implementation steps (prioritized)

Following the requested delivery order; each needs its own verification.

1. **Consolidate Kanban → `GET /tasks/kanban?workspaceId=`** returning first-page tasks for all statuses + grouped counts in **1 request** (replaces F4's ~12). Backend: single grouped query (`groupBy status` for counts + windowed first-N per status). Mobile: replace `fetchKanbanColumn` loop.
2. **Task-detail consolidation → `GET /tasks/:id/detail`** returning task + subtasks + first page of comments/activities; paginate the rest (fixes F5/F6).
3. **Real caching (F3)** — replace no-op wrappers with a shared store (Upstash/Redis) for `workspaces`, `project-lite`, `tags`, `members/reference-data`, `permissions`, with documented TTL + tag invalidation. Do **not** rely on process-local maps in serverless.
4. **Auth (F7)** — add authorization tests first, then for bearer requests prefer the indexed `findUnique({where:{token}})` and avoid the redundant `getSession` round-trip. Memoize the single validation per request.
5. **DTO projections** for task-list / kanban / gantt / detail (stop returning project-member arrays inside every task).
6. **DB indexes** — verify prod indexes vs `prisma/schema.prisma`; add only `EXPLAIN`-backed indexes for `workspaceId`, `projectId`, `parentTaskId`, `assigneeId`, `status`, `dueDate`, `createdAt`, cursor ordering.

---

## 5. Runtime-dependent work (blocked — needs DB/staging credentials)

Run these once a safe staging DB + deployed instance are available; record results in `docs/` before/after:

- **Server-Timing instrumentation** middleware (request-id, auth ms, db ms + query count, serialize ms, bytes, status, cold/warm) — never log tokens/cookies/PII.
- **Benchmarks** (warm/cold p50/p95/p99, error rate, request count, payload bytes) for: sign-in/session, workspace startup, projects, list tasks, filtered tasks, kanban, gantt, task detail, attendance, notifications, conversations, procurement.
- **`EXPLAIN (ANALYZE, BUFFERS)`** on the heavy queries; inspect `pg_stat_statements`, index usage, seq scans, fan-out.
- **Verify** `DATABASE_URL` is the **pooled** connection and the DB region is co-located with Vercel `bom1`.

---

## 6. Performance targets (from brief)
cached/reference reads p95 < 200 ms · normal DB reads p95 < 400 ms · complex task queries p95 < 600 ms · workspace usable < 1 s · **Kanban 1–2 requests (not 12–18)** · task-detail 1–2 requests · typical list payloads < 100–150 KB · no unpaginated growing collections · error rate < 0.5%.

## 7. Rollback
All changes in this pass are isolated to 3 backend files and are additive/guarded:
- Revert F1: restore `getUserProjects(workspaceId)` and remove `description`/`workspaceId` from the lite select.
- Revert F2: restore `const limit = c.req.query("limit") ? parseInt(...) : 500;`.
No migrations, no schema, no data changes. `git checkout -- apps/backend/src/hono/routes/projects.ts apps/backend/src/hono/routes/tasks.ts apps/backend/src/data/project/get-projects.ts`.
