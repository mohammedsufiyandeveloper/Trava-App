/*
  Warnings:

  - The values [TODO,DONE] on the enum `TaskStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `end_date` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `priority` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `progress` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `start_date` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `team_lead` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `ProjectMember` table. All the data in the column will be lost.
  - You are about to drop the column `assigneeId` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `due_date` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `priority` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `settings` on the `Workspace` table. All the data in the column will be lost.
  - You are about to drop the column `message` on the `WorkspaceMember` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `WorkspaceMember` table. All the data in the column will be lost.
  - You are about to drop the `Comment` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[slug]` on the table `Project` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[workspaceMemberId,projectId]` on the table `ProjectMember` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[taskSlug]` on the table `Task` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[inviteCode]` on the table `Workspace` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `slug` to the `Project` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `ProjectMember` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workspaceMemberId` to the `ProjectMember` table without a default value. This is not possible if the table is not empty.
  - Added the required column `createdById` to the `Task` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `Task` table without a default value. This is not possible if the table is not empty.
  - Added the required column `taskSlug` to the `Task` table without a default value. This is not possible if the table is not empty.
  - Added the required column `inviteCode` to the `Workspace` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `WorkspaceMember` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ProjectRole" AS ENUM ('LEAD', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "TaskTag" AS ENUM ('DESIGN', 'PROCUREMENT', 'CONTRACTOR');

-- AlterEnum
BEGIN;
CREATE TYPE "TaskStatus_new" AS ENUM ('TO_DO', 'IN_PROGRESS', 'BLOCKED', 'REVIEW', 'HOLD', 'COMPLETED');
ALTER TABLE "public"."Task" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Task" ALTER COLUMN "status" TYPE "TaskStatus_new" USING ("status"::text::"TaskStatus_new");
ALTER TYPE "TaskStatus" RENAME TO "TaskStatus_old";
ALTER TYPE "TaskStatus_new" RENAME TO "TaskStatus";
DROP TYPE "public"."TaskStatus_old";
ALTER TABLE "Task" ALTER COLUMN "status" SET DEFAULT 'TO_DO';
COMMIT;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WorkspaceRole" ADD VALUE 'OWNER';
ALTER TYPE "WorkspaceRole" ADD VALUE 'VIEWER';

-- DropForeignKey
ALTER TABLE "Comment" DROP CONSTRAINT "Comment_taskId_fkey";

-- DropForeignKey
ALTER TABLE "Comment" DROP CONSTRAINT "Comment_userId_fkey";

-- DropForeignKey
ALTER TABLE "Project" DROP CONSTRAINT "Project_team_lead_fkey";

-- DropForeignKey
ALTER TABLE "ProjectMember" DROP CONSTRAINT "ProjectMember_userId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_assigneeId_fkey";

-- DropIndex
DROP INDEX "ProjectMember_userId_projectId_key";

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "end_date",
DROP COLUMN "priority",
DROP COLUMN "progress",
DROP COLUMN "start_date",
DROP COLUMN "status",
DROP COLUMN "team_lead",
ADD COLUMN     "slug" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ProjectMember" DROP COLUMN "userId",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "hasAccess" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "projectRole" "ProjectRole" NOT NULL DEFAULT 'MEMBER',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "workspaceMemberId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "assigneeId",
DROP COLUMN "due_date",
DROP COLUMN "priority",
DROP COLUMN "title",
DROP COLUMN "type",
ADD COLUMN     "assigneeTo" TEXT,
ADD COLUMN     "createdById" TEXT NOT NULL,
ADD COLUMN     "days" INTEGER,
ADD COLUMN     "isPinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "parentTaskId" TEXT,
ADD COLUMN     "pinnedAt" TIMESTAMP(3),
ADD COLUMN     "pinnedBy" TEXT,
ADD COLUMN     "position" INTEGER,
ADD COLUMN     "startDate" TIMESTAMP(3),
ADD COLUMN     "tag" "TaskTag",
ADD COLUMN     "taskSlug" TEXT NOT NULL,
ALTER COLUMN "status" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'TO_DO';

-- AlterTable
ALTER TABLE "Workspace" DROP COLUMN "settings",
ADD COLUMN     "inviteCode" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "WorkspaceMember" DROP COLUMN "message",
DROP COLUMN "role",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "workspaceRole" "WorkspaceRole" NOT NULL DEFAULT 'MEMBER';

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "contactNumber" TEXT,
ADD COLUMN     "surname" TEXT;

-- DropTable
DROP TABLE "Comment";

-- DropEnum
DROP TYPE "Priority";

-- DropEnum
DROP TYPE "ProjectStatus";

-- DropEnum
DROP TYPE "TaskType";

-- CreateTable
CREATE TABLE "Clints" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "registeredCompanyName" TEXT,
    "gstNumber" TEXT,
    "directorName" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT,

    CONSTRAINT "Clints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClintMembers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "contactNumber" TEXT,
    "clintId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClintMembers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewComment" (
    "id" TEXT NOT NULL,
    "subTaskId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "attachment" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "parentCommentId" TEXT,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "editedAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceMemberId" TEXT NOT NULL,
    "beforeState" JSONB,
    "afterState" JSONB NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_TaskDependency" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TaskDependency_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "ReviewComment_subTaskId_createdAt_idx" ON "ReviewComment"("subTaskId", "createdAt");

-- CreateIndex
CREATE INDEX "comment_taskId_idx" ON "comment"("taskId");

-- CreateIndex
CREATE INDEX "comment_userId_idx" ON "comment"("userId");

-- CreateIndex
CREATE INDEX "comment_parentCommentId_idx" ON "comment"("parentCommentId");

-- CreateIndex
CREATE INDEX "comment_createdAt_idx" ON "comment"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "audit_log_operationId_key" ON "audit_log"("operationId");

-- CreateIndex
CREATE INDEX "audit_log_entityId_idx" ON "audit_log"("entityId");

-- CreateIndex
CREATE INDEX "audit_log_entityType_idx" ON "audit_log"("entityType");

-- CreateIndex
CREATE INDEX "audit_log_action_idx" ON "audit_log"("action");

-- CreateIndex
CREATE INDEX "audit_log_projectId_idx" ON "audit_log"("projectId");

-- CreateIndex
CREATE INDEX "audit_log_userId_idx" ON "audit_log"("userId");

-- CreateIndex
CREATE INDEX "audit_log_timestamp_idx" ON "audit_log"("timestamp");

-- CreateIndex
CREATE INDEX "audit_log_operationId_idx" ON "audit_log"("operationId");

-- CreateIndex
CREATE INDEX "_TaskDependency_B_index" ON "_TaskDependency"("B");

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");

-- CreateIndex
CREATE INDEX "Project_workspaceId_idx" ON "Project"("workspaceId");

-- CreateIndex
CREATE INDEX "Project_workspaceId_createdAt_idx" ON "Project"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "Project_slug_idx" ON "Project"("slug");

-- CreateIndex
CREATE INDEX "ProjectMember_projectId_projectRole_idx" ON "ProjectMember"("projectId", "projectRole");

-- CreateIndex
CREATE INDEX "ProjectMember_projectId_idx" ON "ProjectMember"("projectId");

-- CreateIndex
CREATE INDEX "ProjectMember_workspaceMemberId_idx" ON "ProjectMember"("workspaceMemberId");

-- CreateIndex
CREATE INDEX "ProjectMember_projectId_workspaceMemberId_idx" ON "ProjectMember"("projectId", "workspaceMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_workspaceMemberId_projectId_key" ON "ProjectMember"("workspaceMemberId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Task_taskSlug_key" ON "Task"("taskSlug");

-- CreateIndex
CREATE INDEX "Task_parentTaskId_idx" ON "Task"("parentTaskId");

-- CreateIndex
CREATE INDEX "Task_projectId_idx" ON "Task"("projectId");

-- CreateIndex
CREATE INDEX "Task_projectId_parentTaskId_idx" ON "Task"("projectId", "parentTaskId");

-- CreateIndex
CREATE INDEX "Task_projectId_status_idx" ON "Task"("projectId", "status");

-- CreateIndex
CREATE INDEX "Task_status_createdAt_idx" ON "Task"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Task_createdById_idx" ON "Task"("createdById");

-- CreateIndex
CREATE INDEX "Task_assigneeTo_idx" ON "Task"("assigneeTo");

-- CreateIndex
CREATE INDEX "Task_isPinned_idx" ON "Task"("isPinned");

-- CreateIndex
CREATE INDEX "Task_position_idx" ON "Task"("position");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_inviteCode_key" ON "Workspace"("inviteCode");

-- CreateIndex
CREATE INDEX "WorkspaceMember_workspaceId_workspaceRole_idx" ON "WorkspaceMember"("workspaceId", "workspaceRole");

-- CreateIndex
CREATE INDEX "WorkspaceMember_workspaceId_idx" ON "WorkspaceMember"("workspaceId");

-- CreateIndex
CREATE INDEX "WorkspaceMember_userId_idx" ON "WorkspaceMember"("userId");

-- CreateIndex
CREATE INDEX "WorkspaceMember_workspaceId_userId_idx" ON "WorkspaceMember"("workspaceId", "userId");

-- CreateIndex
CREATE INDEX "WorkspaceMember_workspaceRole_idx" ON "WorkspaceMember"("workspaceRole");

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_workspaceMemberId_fkey" FOREIGN KEY ("workspaceMemberId") REFERENCES "WorkspaceMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clints" ADD CONSTRAINT "Clints_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClintMembers" ADD CONSTRAINT "ClintMembers_clintId_fkey" FOREIGN KEY ("clintId") REFERENCES "Clints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeTo_fkey" FOREIGN KEY ("assigneeTo") REFERENCES "ProjectMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "WorkspaceMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewComment" ADD CONSTRAINT "ReviewComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "WorkspaceMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewComment" ADD CONSTRAINT "ReviewComment_subTaskId_fkey" FOREIGN KEY ("subTaskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment" ADD CONSTRAINT "comment_parentCommentId_fkey" FOREIGN KEY ("parentCommentId") REFERENCES "comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment" ADD CONSTRAINT "comment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment" ADD CONSTRAINT "comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_workspaceMemberId_fkey" FOREIGN KEY ("workspaceMemberId") REFERENCES "WorkspaceMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TaskDependency" ADD CONSTRAINT "_TaskDependency_A_fkey" FOREIGN KEY ("A") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TaskDependency" ADD CONSTRAINT "_TaskDependency_B_fkey" FOREIGN KEY ("B") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
