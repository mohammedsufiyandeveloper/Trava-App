# Filter Loading State Fix

## Issue
When applying filters in the workspace view, subtasks were loading in the background but there was no loading indicator shown to the user. This made the screen appear blank while data was being fetched, creating a poor user experience.

## Root Cause
The `useEffect` hook that loads subtasks when filters are applied was running asynchronously without tracking its loading state. The UI had no way to know that data was being loaded, so it would show "No tasks found" immediately.

## Solution

### 1. Added Loading State
Added a new state variable to track when subtasks are being loaded for filters:
```typescript
const [isLoadingFilters, setIsLoadingFilters] = useState(false);
```

### 2. Updated Filter Loading Logic
Modified the `useEffect` to:
- Set `isLoadingFilters = true` when starting to load subtasks
- Use `Promise.all()` to wait for all subtask loading to complete
- Set `isLoadingFilters = false` when all loading is done

**Before:**
```typescript
tasks.forEach(async (task) => {
    // Load subtasks without tracking completion
});
```

**After:**
```typescript
const tasksNeedingSubtasks = tasks.filter(task => !task.subTasks || task.subTasks.length === 0);

if (tasksNeedingSubtasks.length > 0) {
    setIsLoadingFilters(true);
    
    Promise.all(
        tasksNeedingSubtasks.map(async (task) => {
            // Load subtasks
        })
    ).finally(() => {
        setIsLoadingFilters(false);
    });
}
```

### 3. Added Loading Indicator UI
Added a loading indicator that shows when `isLoadingFilters` is true:

```typescript
{/* Loading indicator when loading subtasks for filters */}
{isLoadingFilters && filteredTasks.length === 0 && (
    <TableRow>
        <TableCell colSpan={9} className="h-32 text-center">
            <div className="flex flex-col items-center justify-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Loading tasks...</span>
            </div>
        </TableCell>
    </TableRow>
)}

{/* Only show "No tasks found" when NOT loading */}
{filteredTasks.length === 0 && !isLoadingFilters && (
    <TableRow>
        <TableCell colSpan={9} className="h-24 text-center">
            No tasks found.
        </TableCell>
    </TableRow>
)}
```

## User Experience Improvements

### Before:
1. User applies filter (e.g., assignee filter)
2. Screen shows blank or "No tasks found" immediately
3. After a delay, tasks suddenly appear
4. Confusing and looks broken

### After:
1. User applies filter
2. Loading spinner appears with "Loading tasks..." message
3. User knows the system is working
4. Tasks appear when ready
5. Clear, professional experience

## Technical Details

### Files Modified:
- `src/components/task/list/task-table.tsx`

### Changes:
1. Added `isLoadingFilters` state variable
2. Updated filter loading `useEffect` to use `Promise.all()` and track loading state
3. Added loading indicator UI component
4. Updated "No tasks found" condition to only show when not loading

### Loading Flow:
```
Filter Applied
    ↓
Check if subtasks need loading
    ↓
Set isLoadingFilters = true
    ↓
Show loading spinner
    ↓
Load all subtasks in parallel (Promise.all)
    ↓
Update tasks state
    ↓
Set isLoadingFilters = false
    ↓
Show filtered results or "No tasks found"
```

## Testing

### Test Cases:
- [ ] Apply assignee filter in workspace view → Shows loading spinner
- [ ] Apply status filter → Shows loading spinner
- [ ] Apply tag filter → Shows loading spinner
- [ ] Apply date range filter → Shows loading spinner
- [ ] Apply project filter → Shows loading spinner
- [ ] Apply multiple filters → Shows loading spinner
- [ ] Loading completes → Spinner disappears, results shown
- [ ] No results after loading → Shows "No tasks found" (not loading spinner)
- [ ] Project-level filtering → Works as before (already has subtasks)

## Performance Considerations

- Uses `Promise.all()` to load all subtasks in parallel (faster than sequential)
- Only loads subtasks for tasks that don't have them loaded yet
- Loading state prevents multiple simultaneous loads
- Maximum 100 subtasks loaded per task (as before)
