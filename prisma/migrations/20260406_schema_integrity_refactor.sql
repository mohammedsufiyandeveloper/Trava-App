-- Ensure "ProjectMember" has all necessary members based on Task history
INSERT INTO "ProjectMember" (id, "projectRole", "projectId", "workspaceMemberId", "hasAccess", "createdAt", "updatedAt")
SELECT DISTINCT gen_random_uuid(), 'MEMBER', t."projectId", wm.id, true, NOW(), NOW()
FROM "Task" t
JOIN "WorkspaceMember" wm ON wm."userId" = t."createdById" AND wm."workspaceId" = t."workspaceId"
WHERE NOT EXISTS (
    SELECT 1 FROM "ProjectMember" pm 
    WHERE pm."workspaceMemberId" = wm.id 
    AND pm."projectId" = t."projectId"
)
ON CONFLICT DO NOTHING;

INSERT INTO "ProjectMember" (id, "projectRole", "projectId", "workspaceMemberId", "hasAccess", "createdAt", "updatedAt")
SELECT DISTINCT gen_random_uuid(), 'MEMBER', t."projectId", wm.id, true, NOW(), NOW()
FROM "Task" t
JOIN "WorkspaceMember" wm ON wm."userId" = t."assigneeId" AND wm."workspaceId" = t."workspaceId"
WHERE t."assigneeId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "ProjectMember" pm 
    WHERE pm."workspaceMemberId" = wm.id 
    AND pm."projectId" = t."projectId"
)
ON CONFLICT DO NOTHING;

INSERT INTO "ProjectMember" (id, "projectRole", "projectId", "workspaceMemberId", "hasAccess", "createdAt", "updatedAt")
SELECT DISTINCT gen_random_uuid(), 'MEMBER', t."projectId", wm.id, true, NOW(), NOW()
FROM "Task" t
JOIN "WorkspaceMember" wm ON wm."userId" = t."reviewerId" AND wm."workspaceId" = t."workspaceId"
WHERE t."reviewerId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "ProjectMember" pm 
    WHERE pm."workspaceMemberId" = wm.id 
    AND pm."projectId" = t."projectId"
)
ON CONFLICT DO NOTHING;

-- Add backup columns directly (unquoted IF NOT EXISTS is fine in Postgres 9.6+)
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "old_createdById" TEXT;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "old_reviewerId" TEXT;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "old_assigneeId" TEXT;

-- Backup current data
UPDATE "Task" SET "old_createdById" = "createdById", "old_reviewerId" = "reviewerId", "old_assigneeId" = "assigneeId";

-- Remap Task IDs to ProjectMember IDs
UPDATE "Task" t
SET "assigneeId" = pm.id
FROM "ProjectMember" pm
JOIN "WorkspaceMember" wm ON pm."workspaceMemberId" = wm.id
WHERE t."projectId" = pm."projectId"
  AND t."old_assigneeId" = wm."userId"
  AND t."old_assigneeId" IS NOT NULL;

UPDATE "Task" t
SET "createdById" = pm.id
FROM "ProjectMember" pm
JOIN "WorkspaceMember" wm ON pm."workspaceMemberId" = wm.id
WHERE t."projectId" = pm."projectId"
  AND t."old_createdById" = wm."userId"
  AND t."old_createdById" IS NOT NULL;

UPDATE "Task" t
SET "reviewerId" = pm.id
FROM "ProjectMember" pm
JOIN "WorkspaceMember" wm ON pm."workspaceMemberId" = wm.id
WHERE t."projectId" = pm."projectId"
  AND t."old_reviewerId" = wm."userId"
  AND t."old_reviewerId" IS NOT NULL;

-- Handle other models
UPDATE "indent_details" id
SET "assignedTo" = wm.id
FROM "WorkspaceMember" wm
WHERE id."assignedTo" = wm."userId" 
  AND id."workspaceId" = wm."workspaceId"
  AND length(id."assignedTo") > 30;

UPDATE "indent_details" id
SET "requestedBy" = wm.id
FROM "WorkspaceMember" wm
WHERE id."requestedBy" = wm."userId" 
  AND id."workspaceId" = wm."workspaceId"
  AND length(id."requestedBy") > 30;

UPDATE "indent_item" ii
SET "finalApprovedBy" = wm.id
FROM "indent_details" id2
JOIN "WorkspaceMember" wm ON id2."workspaceId" = wm."workspaceId"
WHERE ii."indentDetailsId" = id2.id 
  AND ii."finalApprovedBy" = wm."userId"
  AND ii."finalApprovedBy" IS NOT NULL
  AND length(ii."finalApprovedBy") > 30;

UPDATE "indent_item" ii
SET "quantityApprovedBy" = wm.id
FROM "indent_details" id2
JOIN "WorkspaceMember" wm ON id2."workspaceId" = wm."workspaceId"
WHERE ii."indentDetailsId" = id2.id 
  AND ii."quantityApprovedBy" = wm."userId"
  AND ii."quantityApprovedBy" IS NOT NULL
  AND length(ii."quantityApprovedBy") > 30;

UPDATE "purchase_order" po
SET "createdById" = wm.id
FROM "WorkspaceMember" wm
WHERE po."createdById" = wm."userId" 
  AND po."workspaceId" = wm."workspaceId"
  AND length(po."createdById") > 30;

UPDATE "purchase_order" po
SET "approvedById" = wm.id
FROM "WorkspaceMember" wm
WHERE po."approvedById" = wm."userId" 
  AND po."workspaceId" = wm."workspaceId"
  AND po."approvedById" IS NOT NULL
  AND length(po."approvedById") > 30;

UPDATE "purchase_order_payment" pop
SET "recordedById" = wm.id
FROM "purchase_order" po
JOIN "WorkspaceMember" wm ON po."workspaceId" = wm."workspaceId"
WHERE pop."purchaseOrderId" = po.id 
  AND pop."recordedById" = wm."userId"
  AND length(pop."recordedById") > 30;

UPDATE "unit" u
SET "createdBy" = wm.id
FROM "WorkspaceMember" wm
WHERE u."createdBy" = wm."userId" 
  AND u."workspaceId" = wm."workspaceId"
  AND u."createdBy" IS NOT NULL
  AND length(u."createdBy") > 30;
