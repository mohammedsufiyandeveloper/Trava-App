import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function migrate() {
  console.log('Starting data migration...');

  try {
    // 1. Add backup columns to Task for safety
    console.log('Adding backup columns to Task...');
    await prisma.$executeRawUnsafe(`ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "old_createdById" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "old_reviewerId" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "old_assigneeId" TEXT`);

    // 2. Backup current data in Task
    console.log('Backing up Task data...');
    await prisma.$executeRawUnsafe(`UPDATE "Task" SET "old_createdById" = "createdById", "old_reviewerId" = "reviewerId", "old_assigneeId" = "assigneeId"`);

    // 3. Ensure all Task participants are ProjectMembers
    console.log('Ensuring all task participants are ProjectMembers...');
    // Creators
    await prisma.$executeRawUnsafe(`
      INSERT INTO "ProjectMember" (id, "projectRole", "projectId", "workspaceMemberId", "hasAccess", "createdAt", "updatedAt")
      SELECT DISTINCT gen_random_uuid(), 'MEMBER'::"ProjectRole", t."projectId", wm.id, true, NOW(), NOW()
      FROM "Task" t
      JOIN "WorkspaceMember" wm ON wm."userId" = t."old_createdById" AND wm."workspaceId" = t."workspaceId"
      WHERE NOT EXISTS (
          SELECT 1 FROM "ProjectMember" pm 
          WHERE pm."workspaceMemberId" = wm.id 
          AND pm."projectId" = t."projectId"
      )
    `);
    // Assignees
    await prisma.$executeRawUnsafe(`
      INSERT INTO "ProjectMember" (id, "projectRole", "projectId", "workspaceMemberId", "hasAccess", "createdAt", "updatedAt")
      SELECT DISTINCT gen_random_uuid(), 'MEMBER'::"ProjectRole", t."projectId", wm.id, true, NOW(), NOW()
      FROM "Task" t
      JOIN "WorkspaceMember" wm ON wm."userId" = t."old_assigneeId" AND wm."workspaceId" = t."workspaceId"
      WHERE t."old_assigneeId" IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM "ProjectMember" pm 
          WHERE pm."workspaceMemberId" = wm.id 
          AND pm."projectId" = t."projectId"
      )
    `);

    // 4. Update Task references
    console.log('Updating Task references...');
    await prisma.$executeRawUnsafe(`
      UPDATE "Task" t
      SET "createdById" = pm.id
      FROM "ProjectMember" pm
      JOIN "WorkspaceMember" wm ON pm."workspaceMemberId" = wm.id
      WHERE t."projectId" = pm."projectId"
        AND t."old_createdById" = wm."userId"
    `);
    await prisma.$executeRawUnsafe(`
      UPDATE "Task" t
      SET "assigneeId" = pm.id
      FROM "ProjectMember" pm
      JOIN "WorkspaceMember" wm ON pm."workspaceMemberId" = wm.id
      WHERE t."projectId" = pm."projectId"
        AND t."old_assigneeId" = wm."userId"
        AND t."old_assigneeId" IS NOT NULL
    `);
    await prisma.$executeRawUnsafe(`
      UPDATE "Task" t
      SET "reviewerId" = pm.id
      FROM "ProjectMember" pm
      JOIN "WorkspaceMember" wm ON pm."workspaceMemberId" = wm.id
      WHERE t."projectId" = pm."projectId"
        AND t."old_reviewerId" = wm."userId"
        AND t."old_reviewerId" IS NOT NULL
    `);

    // 5. Update other tables (WorkspaceMember references)
    console.log('Updating other table references...');
    
    // indent_details
    await prisma.$executeRawUnsafe(`
      UPDATE "indent_details" id
      SET "assignedTo" = wm.id
      FROM "WorkspaceMember" wm
      WHERE id."assignedTo" = wm."userId" AND id."workspaceId" = wm."workspaceId"
    `);
    await prisma.$executeRawUnsafe(`
      UPDATE "indent_details" id
      SET "requestedBy" = wm.id
      FROM "WorkspaceMember" wm
      WHERE id."requestedBy" = wm."userId" AND id."workspaceId" = wm."workspaceId"
    `);

    // purchase_order
    await prisma.$executeRawUnsafe(`
      UPDATE "purchase_order" po
      SET "createdById" = wm.id
      FROM "WorkspaceMember" wm
      WHERE po."createdById" = wm."userId" AND po."workspaceId" = wm."workspaceId"
    `);

    // unit
    await prisma.$executeRawUnsafe(`
      UPDATE "unit" u
      SET "createdBy" = wm.id
      FROM "WorkspaceMember" wm
      WHERE u."createdBy" = wm."userId" AND u."workspaceId" = wm."workspaceId" AND u."createdBy" IS NOT NULL
    `);

    console.log('Migration completed successfully!');

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrate();
