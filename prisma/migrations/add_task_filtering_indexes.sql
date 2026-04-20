-- Migration: Add Performance Indexes for Task Filtering
-- Created: 2026-01-24
-- Purpose: Optimize global task filtering for large datasets (50k-200k+ tasks)

-- ============================================================================
-- FULL-TEXT SEARCH INDEXES (Trigram)
-- ============================================================================
-- Enable pg_trgm extension for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Index for task name search
CREATE INDEX IF NOT EXISTS idx_task_name_trgm 
ON "Task" USING gin (name gin_trgm_ops);

-- Index for task description search
CREATE INDEX IF NOT EXISTS idx_task_description_trgm 
ON "Task" USING gin (description gin_trgm_ops);

-- Index for task slug search
CREATE INDEX IF NOT EXISTS idx_task_slug_trgm 
ON "Task" USING gin ("taskSlug" gin_trgm_ops);

-- ============================================================================
-- COMPOSITE INDEXES FOR WORKSPACE-LEVEL FILTERING
-- ============================================================================
-- Workspace + Status (for global workspace filtering)
CREATE INDEX IF NOT EXISTS idx_task_workspace_status 
ON "Task"("workspaceId", status);

-- Workspace + Assignee (for "my tasks" views)
CREATE INDEX IF NOT EXISTS idx_task_workspace_assignee 
ON "Task"("workspaceId", "assigneeTo");

-- ============================================================================
-- COMPOSITE INDEXES FOR DATE-BASED FILTERING
-- ============================================================================
-- Assignee + Created Date (for assignee task history)
CREATE INDEX IF NOT EXISTS idx_task_assignee_created 
ON "Task"("assigneeTo", "createdAt");

-- Project + Start Date (for project timeline views)
CREATE INDEX IF NOT EXISTS idx_task_project_startdate 
ON "Task"("projectId", "startDate");

-- Workspace + Start Date (for global timeline views)
CREATE INDEX IF NOT EXISTS idx_task_workspace_startdate 
ON "Task"("workspaceId", "startDate");

-- ============================================================================
-- COVERING INDEXES (Index-Only Scans)
-- ============================================================================
-- Project + Status + Position (for Kanban boards)
CREATE INDEX IF NOT EXISTS idx_task_project_status_position 
ON "Task"("projectId", status, position);

-- Workspace + IsPinned + CreatedAt (for pinned task lists)
CREATE INDEX IF NOT EXISTS idx_task_workspace_pinned_created 
ON "Task"("workspaceId", "isPinned", "createdAt");

-- ============================================================================
-- PARTIAL INDEXES (For Specific Use Cases)
-- ============================================================================
-- Index only pinned tasks (reduces index size)
CREATE INDEX IF NOT EXISTS idx_task_pinned_only 
ON "Task"("workspaceId", "projectId", "createdAt") 
WHERE "isPinned" = true;

-- Index only incomplete tasks (TODO, IN_PROGRESS)
CREATE INDEX IF NOT EXISTS idx_task_incomplete_only 
ON "Task"("workspaceId", "projectId", status) 
WHERE status IN ('TODO', 'IN_PROGRESS');

-- ============================================================================
-- ANALYZE TABLES (Update Statistics)
-- ============================================================================
-- Update table statistics for query planner
ANALYZE "Task";

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these to verify indexes were created:

-- List all Task indexes
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'Task' ORDER BY indexname;

-- Check index usage statistics
-- SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read
-- FROM pg_stat_user_indexes
-- WHERE tablename = 'Task'
-- ORDER BY idx_scan DESC;

-- Analyze a sample query
-- EXPLAIN ANALYZE
-- SELECT * FROM "Task"
-- WHERE "workspaceId" = 'your-workspace-id'
--   AND status IN ('TODO', 'IN_PROGRESS')
-- ORDER BY "isPinned" DESC, "createdAt" DESC
-- LIMIT 10;
