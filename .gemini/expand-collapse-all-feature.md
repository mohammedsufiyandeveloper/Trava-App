# Expand/Collapse All Feature

## Feature
Added a new dropdown menu in the task table header to allow users to "Expand All" or "Collapse All" tasks at once.

## Implementation Details

### 1. UI Components
- Added a `DropdownMenu` trigger in the first column header (previously empty).
- Uses `ChevronsUpDown` icon for the trigger.
- Provides two options:
    - **Expand All** (`Maximize2` icon)
    - **Collapse All** (`Minimize2` icon)

### 2. Logic: Expand All (`handleExpandAll`)
- Immediately updates local `expanded` state to show all tasks as expanded.
- Identifies parent tasks that don't have subtasks loaded yet.
- Sets `loadingSubTasks` state for these tasks to show loading skeletons.
- Fetches subtasks for all needing tasks in parallel using `Promise.all`.
- Updates `tasks` state with the fetched subtasks.
- Clears loading state upon completion.

### 3. Logic: Collapse All (`handleCollapseAll`)
- Simply resets the `expanded` state to an empty object `{}`.

## Files Modified
- `src/components/task/list/task-table.tsx`

## Usage
Click the chevron icon in the top-left of the task table to access the menu.
