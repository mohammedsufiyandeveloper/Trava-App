# Assignee Filter ID Mismatch Fix

## Issue
The user reported that the assignee filter was not working, specifically identifying that they are using User IDs for filtering, but getting no results.

## Root Cause
The assignee filter options were being constructed using the `WorkspaceMember` ID (`member.id`), whereas the tasks/subtasks use the `User` ID (`task.assignee.id`) for the assignee field. This ID mismatch meant that even when a user was selected in the filter, their ID (WorkspaceMember ID) didn't match the assignee ID (User ID) on the tasks.

## Solution

### 1. Updated Workspace List View
In `src/app/w/[workspaceId]/tasks/_components/views/list/workspace-list-view.tsx`, I updated the `assigneesFromMembers` mapping to use the User ID:

```typescript
// Before
id: member.id, // workspaceMemberId

// After
id: member.user?.id || member.userId, // Use user ID for filtering matches task.assignee.id
```

### 2. Updated Task Table Default Logic
In `src/components/task/list/task-table.tsx`, I updated the fallback logic (used when assignees aren't pre-calculated) to also favor the User ID:

```typescript
// Before
id: member.workspaceMember.id, // Use workspaceMember.id for filtering

// After
id: member.workspaceMember.user?.id || member.workspaceMember.id, // Use user ID first
```

## Impact
- **Workspace View**: Now uses User IDs for assignee filter options.
- **Project View**: Uses `extractAssigneeOptions` on tasks, which already uses User IDs, so it should be consistent.
- **Filtering**: When a user selects an assignee from the dropdown, the filter will now apply the User ID. Since subtasks have `assignee.id` as the User ID (confirmed via schema and data fetching logic), the filter condition `subTask.assignee?.id === filters.assigneeId` will now evaluate to true for matching tasks.

## Files Modified
- `src/app/w/[workspaceId]/tasks/_components/views/list/workspace-list-view.tsx`
- `src/components/task/list/task-table.tsx`

## Font Loading Warning Fix

### Issue
User reported `Failed to download 'Geist Mono' from Google Fonts`.

### Solution
Updated `src/app/layout.tsx` to add `display: 'swap'` to the font configuration. This is a best practice that allows the text to display immediately using a fallback font while the custom font loads, and can help mitigate loading issues or warnings in some environments.
