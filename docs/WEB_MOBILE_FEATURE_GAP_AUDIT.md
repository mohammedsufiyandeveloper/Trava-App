# Trava Web-to-Mobile Feature Gap Audit

Audit date: 2026-08-01

## Comparison baseline

- Web UI: Git revision `3db8591df40f9aa9737ef5d9ef8c3508f853983c`, the last full Next.js tree immediately before the web UI was removed.
- Mobile UI: current `apps/mobile` source at revision `b1ec43d`.
- API/backend: current `apps/backend` source at revision `b1ec43d`.

This is a source-level parity audit. A feature is marked missing only when the web has a user-facing implementation and the mobile app has no equivalent reachable UI/flow. Items implemented differently but serving the same outcome are not counted as missing.

## Confirmed missing features

### P0 — Core business workflows

1. **Daily work reports**
   - Web users can submit a daily report with one or more task/work entries, search suggested tasks/subtasks, choose "Other Work", and enter a minimum-length description.
   - Web admins can browse reports grouped by date/member, see submitted and not-submitted states, filter by date/member, search, paginate, expand details, and inspect report entries.
   - The web also exposes a report FAB/reminder based on daily-report status.
   - Mobile has no report screen, submission form, report history/admin view, navigation entry, or mobile API methods. The backend still contains daily-report data/actions, but no current Hono REST routes expose the complete flow.
   - Historical evidence: `src/app/w/[workspaceId]/reports/**`, `src/actions/daily-report-actions.ts`, `src/actions/daily-report/**`, and `src/data/daily-report/**` in `3db8591`.

2. **Workspace creation and no-workspace onboarding**
   - The web redirects users without a workspace into a create-workspace flow and lets eligible users create one or continue to an existing workspace.
   - Mobile can select existing workspaces but has no create-workspace screen or empty-account recovery flow.
   - The backend retains `create-workspace.ts`, but the current Hono workspace router has no create endpoint.
   - Historical evidence: `src/app/(auth)/create-workspace/page.tsx`.

3. **Workspace member administration**
   - Web admins can invite a member by identity/contact fields and choose a workspace role.
   - Web admins can inspect member details and remove a member with confirmation.
   - Mobile's Team screen only lists/searches members and starts direct chats. It has no invite/remove/member-admin controls.
   - Current backend routes already expose invite and remove operations, so mobile service wrappers and UI are the main missing pieces.
   - Historical evidence: `src/app/w/[workspaceId]/team/_components/create-user.tsx` and `team-members-table.tsx`.

4. **Bulk upload of tasks and subtasks**
   - The web can upload a spreadsheet, parse and validate its rows, preview imported tasks/subtasks, surface row errors, and submit a bulk creation operation.
   - Mobile has no import action, file-selection flow, preview, validation report, or bulk-submit UI/API wrapper.
   - Historical evidence: `src/app/w/[workspaceId]/p/[slug]/_components/forms/bulk-upload-form.tsx` and `src/actions/task/bulk-create-taskAndSubTask.ts`.

### P1 — Administration and authentication

5. **Complete workspace organization/legal profile**
   - The web has editable/read-only workspace information for name, description, legal entity name, industry, company type, GST, PAN, MSME, email, phone, website, address lines, city, state, country, and pincode.
   - Mobile Workspace Settings currently covers the workspace name plus attendance/leave thresholds only.
   - The current mobile settings endpoint/payload must be checked and extended without breaking the newer attendance settings.
   - Historical evidence: `src/app/w/[workspaceId]/info/**`.

6. **Workspace-wide audit log**
   - The web exposes an admin activity log with time, actor, action, entity details/deltas, source IP, search, pagination, and realtime refresh behavior.
   - Mobile has project activity and general activity feeds, but no equivalent administrative workspace audit-log screen showing field deltas/source information.
   - Historical evidence: `src/app/w/[workspaceId]/settings/activity/**`.

7. **Google sign-in/sign-up**
   - The web offers Google OAuth for login and registration.
   - Mobile supports email/password login and an email verification signup path only.
   - Historical evidence: web sign-in and sign-up form components under `src/app/(auth)`.

8. **Phone-number OTP sign-in**
   - The web has an email/password versus phone-number login mode, sends a six-digit phone OTP, and verifies it.
   - Mobile has no phone login mode.
   - Historical evidence: `src/app/(auth)/sign-in/_components/loginForm.tsx`.

9. **Invitation-aware authentication/join flow**
   - Web auth accepts invitation context (`workspaceId`, role, invited email), carries it through login/OAuth, and joins/verifies the user into the target workspace.
   - Mobile auth has no deep-link invitation handling or post-auth workspace join flow.
   - Historical evidence: web login form and `src/app/api/verify/route.ts`.

10. **Full registration field parity**
    - The web email signup collects first name, last name, surname/display name, phone number, email, and password, then performs email verification.
    - Mobile collects only first name, last name, and email and sends the user back to login after requesting verification; it has no password/phone fields in the visible signup flow.
    - This should be reconciled with the current Better Auth contract before implementation because the mobile flow may currently leave account completion to a link.

### P1 — Task planning and board interactions

11. **Advanced editable Gantt planning**
    - Web Gantt supports dragging a subtask bar to move dates, resizing either edge to change start/due date, reordering subtasks, managing dependencies, and drawing dependency lines.
    - Mobile Gantt is currently a read-only timeline whose bars navigate to task details.
    - Historical evidence: `src/components/task/gantt/draggable-subtask-bar.tsx`, `sortable-subtask-list.tsx`, `dependency-picker.tsx`, and `dependency-lines.tsx`.

12. **Gantt export and richer timeline controls**
    - Web Gantt exports Excel and PDF, supports day/week/month granularity, jump-to-today, expand/collapse all, grouped/flat modes, and optional detail columns.
    - Mobile has the timeline/table view but no export and lacks most of these controls.
    - Historical evidence: `src/components/task/gantt/gantt-chart.tsx` and `export-utils.ts`.

13. **Kanban drag-and-drop ordering and pinning**
    - Web Kanban supports dragging cards between status columns and into a specific position, plus pin/unpin behavior.
    - Mobile changes status through a picker and does not provide direct card drag/drop ordering or pin controls.
    - Historical evidence: `src/components/task/kanban/**` and `src/actions/task/kanban/**`.

### P2 — Productivity and display parity

14. **Configurable task-list columns**
    - Web users can toggle description, assignee, reviewer, status, start date, due date/deadline, tag, and project columns.
    - Mobile task tables use a fixed column set. This is functional parity with less customization, so it is lower priority.
    - Historical evidence: `src/components/task/shared/column-visibility.tsx`.

15. **Manual project activity/review note creation outside status transition**
    - The web has an Add Activity dialog accepting text and an optional attachment, and displays activity attachments/status-transition metadata.
    - Mobile can read project/task activity and has a review comment modal during some status changes, but has no general Add Activity action on the project activity screen.
    - The current Hono activities route is GET-only, so a permission-checked write route may be required.
    - Historical evidence: `src/app/w/[workspaceId]/p/[slug]/_components/forms/activity-form.tsx`.

## Partial parity that should be improved, not rebuilt

1. **Task filtering and sorting:** Mobile already supports search, status, assignee, tag, project/date filters, and sorting. The web has a denser multi-filter desktop toolbar and multi-sort behavior. Verify edge cases and server pagination, but do not create a second filter system.
2. **Workspace task views:** Mobile My Tasks already provides workspace-level List, Kanban, and Gantt views. Do not treat these screens as missing.
3. **Project task views:** Mobile already has project List, Kanban, and Gantt views plus task/subtask create, edit, and delete flows.
4. **Project management:** Mobile already creates/edits/deletes projects and manages project members, including the detailed client-project fields.
5. **Tags:** Mobile already creates, edits, and deletes workspace tags.
6. **Task messages/activity:** Mobile already reads task comments/activity and posts task comments. Only the general manual activity creation workflow is missing.
7. **Attendance:** Mobile has check-in/out, team attendance, member statistics, and log/history features; it is not missing.
8. **Notifications/realtime:** Mobile already has notifications, mark-read/mark-all-read, push token registration, Pusher updates, and direct-message realtime behavior.
9. **Theme/account:** Mobile already has light/dark theme, profile editing, password change/reset, email verification initiation, and sign-out.

## Features present in mobile but not in the historical web baseline

Do not remove these while pursuing parity:

- Travis AI assistant.
- Leave requests, balances, and admin approval.
- Procurement/indent workflows.
- Direct one-to-one chat and typing indicators.
- My Space personal todos.
- Push notifications and mobile haptics.
- Mobile attendance widgets and richer attendance settings.

## Recommended implementation order

1. Foundation: add missing REST contracts, permission checks, schemas, typed mobile API wrappers, and tests.
2. P0 workflows: daily reports, workspace onboarding/creation, team administration, and bulk upload.
3. Admin/auth: organization details, audit log, invite deep links, and auth provider parity.
4. Planning interactions: editable Gantt, dependencies/reordering, export, then Kanban drag/pin.
5. P2 polish: configurable columns and general manual activity creation.
6. Run typecheck, lint, backend tests/build, and focused device QA after every vertical slice.

## Ready-to-paste Claude planning prompt

```text
You are working in the Trava monorepo. Your task is to produce a detailed, implementation-ready plan to bring the Expo mobile app to feature parity with the historical Next.js web UI. Do not implement code yet.

Repository:
- Current mobile: apps/mobile
- Current backend: apps/backend
- Audit report: docs/WEB_MOBILE_FEATURE_GAP_AUDIT.md
- Historical web baseline: Git commit 3db8591df40f9aa9737ef5d9ef8c3508f853983c
- Current baseline: the checked-out branch/HEAD

First read the audit report completely. Then independently verify every claimed gap against both:
1. the historical web source using commands such as `git show 3db8591:<path>`, `git ls-tree -r --name-only 3db8591`, or a temporary `git archive`; and
2. the current mobile/backend implementation using `rg`, route inspection, Prisma schema inspection, and navigation/API call-site inspection.

Important constraints:
- Do not assume a screen is missing just because its name differs. Compare user outcomes, permissions, validation, realtime effects, and error/loading/empty states.
- Reuse current Hono routes/actions/services where possible. Identify exactly which gaps need only mobile UI, which need a mobile API wrapper, and which require a new backend route/schema change.
- Preserve current mobile-only features: Travis AI, leave management, procurement, direct chat, My Space, push notifications, haptics, and enhanced attendance.
- Preserve role-based access for OWNER, ADMIN, MANAGER, PROJECT_MANAGER/PROJECT_COORDINATOR, MEMBER, REVIEWER, and VIEWER according to the types/schema actually present in this repo.
- Preserve current task permission validation and do not bypass backend authorization from the client.
- Follow existing React Native theme, responsive, accessibility, haptic, navigation, toast/error, pagination, and realtime patterns.
- Avoid adding web-only interaction patterns directly to mobile. Translate them into touch-safe mobile UX (bottom sheets, long press, explicit drag handles, document sharing, deep links).
- Treat bulk upload and PDF/Excel export as device/file-system workflows requiring Expo-compatible libraries and platform permission/share handling.
- Do not expose secrets or hard-code credentials.
- Do not propose a Prisma migration unless the existing schema truly lacks required data.

The verified gap candidates are:
1. Daily report submission, reminder/status, member history, and admin report browser.
2. Workspace creation and the no-workspace onboarding path.
3. Workspace member invite/details/remove administration.
4. Spreadsheet bulk upload, parse/validate/preview, and bulk task/subtask creation.
5. Full organization/legal/contact/address workspace profile.
6. Admin workspace audit log with deltas and source details.
7. Google OAuth login/signup.
8. Phone-number OTP login.
9. Invitation deep-link and post-auth workspace join flow.
10. Registration field/account-completion parity.
11. Editable Gantt dates by move/resize, subtask reorder, dependencies, and dependency lines.
12. Gantt PDF/Excel export and richer granularity/today/group/expand controls.
13. Kanban card drag/drop ordering and pin/unpin.
14. Configurable task-list columns.
15. General manual activity/review-note creation with optional attachment.

Also verify the audit's “partial parity” section so the plan extends existing screens instead of duplicating them.

Deliver one planning document with these sections:

A. Verified parity matrix
- For every candidate: status = Missing / Partial / Already Present / Obsolete-Broken in Web.
- Cite exact historical web paths and current mobile/backend paths.
- State the user roles affected and the observable acceptance criteria.

B. Dependency and API matrix
- Existing backend route/action that can be reused.
- Missing endpoint, request/response schema, auth/permission rule, validation, audit event, cache invalidation, realtime event, and tests required.
- Mobile service function and TypeScript types required.
- Any Expo/native dependency, with a lower-dependency fallback.

C. Phased implementation plan
- Break work into small vertical slices that can be reviewed and released independently.
- For every slice list exact files to add/change, navigation changes, state/data flow, backend changes, tests, migration risk, failure/rollback behavior, and completion criteria.
- Put foundational API work before UI that depends on it.
- Prioritize P0 core workflows, then P1 admin/auth/planning, then P2 polish.

D. UX plan
- Specify phone and tablet behavior.
- Define loading, skeleton, empty, offline/network-error, validation, permission-denied, destructive-confirmation, success, and realtime-refresh states.
- Define accessibility labels, minimum touch targets, reduced motion, keyboard handling, haptics, and safe-area behavior.

E. Testing plan
- Backend unit/route/permission tests.
- Mobile component/screen tests where the project supports them.
- Manual iOS and Android test matrix for each role.
- Regression cases for existing features.
- Required commands: root typecheck, lint, backend tests, backend build, plus focused tests.

F. Risks and decisions needed
- Rank security, data integrity, auth/deep-link, file handling, offline, performance, and migration risks.
- Clearly identify product decisions that cannot be inferred from code.
- Recommend sensible defaults, but do not silently invent behavior.

G. Final execution checklist
- A checkbox list ordered exactly as Claude should implement it in later coding sessions.
- Include suggested commit boundaries and verification gates.

Be specific enough that another engineer can implement the plan without rediscovering the architecture. Do not write code and do not modify files during this planning task.
```
