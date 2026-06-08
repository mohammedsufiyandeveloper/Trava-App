# Technical Debt & Refactoring Plan

This document tracks known issues deliberately **not** fixed during the monorepo
migration (to avoid behavioral rewrites) and proposes a staged plan. Items are
roughly ordered by priority.

## 1. Legacy procurement/inventory schema drift (backend) — HIGH

A schema-integrity refactor replaced the old procurement models
(`PurchaseOrder`, `ProcurementTask`, `Unit`, `Material`, `IndentDetails`,
`IndentItem`) with `indent`, `indent_line_item`, `material_catalog`,
`vendor_material_capability`, `vendor_quote`. The following files still
reference the **removed** models and are marked `// @ts-nocheck` so the rest of
the codebase type-checks. They are wired into the live `/procurement` route and
will fail at runtime until rewritten:

- `src/actions/procurement/{approve-indent-item,create-indent,create-purchase-order,delete-indent,edit-indent}.ts`
- `src/actions/inventory/{units,vendors,materials}.ts`
- `src/data/procurement/{index,get-procurement-tasks,get-po-details}.ts`
- `src/data/inventory/{units,vendors,materials}.ts`
- `src/lib/procurement/logic.ts`
- `src/server/services/units.service.ts`
- `src/utils/po-utils.ts`
- one call in `src/actions/task/bulk-create-taskAndSubTask.ts`
  (`(tx as any).procurementTask.create`, guarded by `shouldAddToProcurement`)

**Plan:** rewrite these against the new schema (or delete if the mobile
"indent" feature fully replaces them), then remove the `@ts-nocheck` markers and
the `procurementTask` cast. Mobile is already building the replacement screens
(`CreateIndentScreen`, `IndentDetailScreen`, `ProcurementScreen`).

## 2. Oversized files — MEDIUM

Staged refactor (extract modules/hooks; no behavior change):

| File | LOC | Suggested split |
| --- | --- | --- |
| `apps/mobile/src/screens/TaskDetailScreen.tsx` | ~2000 | Extract subcomponents (header, comments, subtasks, attachments) and a `useTaskDetail` hook |
| `apps/mobile/src/screens/MyBoardScreen.tsx` | ~1660 | Extract board column/card components and data hooks |
| `apps/mobile/src/services/api.ts` | ~1525 | Split by domain (tasks, projects, workspace, auth) into `services/api/*`; add typed responses |
| `apps/backend/src/data/task/get-tasks.ts` | ~1160 | Extract filter/where-builder and permission resolution |
| `apps/backend/src/server/services/tasks.service.ts` | ~970 | Split by operation group |
| `apps/backend/src/hono/routes/tasks.ts` | ~765 | Group sub-routers; move validation to schemas |

## 3. Lint warnings — MEDIUM

- Backend: ~678 warnings, mostly `@typescript-eslint/no-explicit-any` and
  unused vars. Reduce `any` at module boundaries first (API inputs/outputs).
- Mobile: ~213 warnings (unused vars, `Array<T>` style, hook deps). Prioritize
  **`react-hooks/exhaustive-deps`** warnings — unsafe effect dependencies are
  the highest-risk category.
- Neither fails CI (warnings only). Don't add new warnings.

## 4. Mobile API base URL hardcoded — LOW

`apps/mobile/src/services/api.ts` hardcodes `API_BASE`. Move it to
`EXPO_PUBLIC_API_BASE` (already noted in `apps/mobile/.env.example`) so dev vs.
prod doesn't require code edits.

## 5. Stale backend `dist/` — LOW

`apps/backend/dist/` (14 files) is build output **not** produced by the current
`tsup` build (which targets `api/`). It is retained per the migration decision
but is unused by Vercel. Consider deleting it and removing from tracking once
confirmed unused.

## 6. Backend tsconfig excludes — LOW

`apps/backend/tsconfig.json` still excludes pre-existing problem paths
(`src/lib/store`, `src/lib/actions`, `src/lib/utils/extract-filter-options.ts`).
Revisit whether these should be type-checked or removed.

## 7. Tests rely on `.env` presence — LOW

The backend vitest suite loads `.env` via `dotenv` but passes without it (Prisma
and external services are mocked). Consider an explicit test env file so local
runs don't depend on real `.env`.
