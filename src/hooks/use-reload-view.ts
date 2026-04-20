"use client";

/**
 * Hook to trigger a reload of the current view
 * 
 * This hook provides a simple function to reload data across all views
 * (Dashboard, List, Kanban, Gantt) by dispatching a custom event that
 * the ReloadableView component listens for.
 * 
 * @example
 * ```tsx
 * import { useReloadView } from "@/hooks/use-reload-view";
 * 
 * export function MyComponent() {
 *   const reloadView = useReloadView();
 * 
 *   const handleUpdate = async () => {
 *     await updateTaskAction(taskId, data);
 *     reloadView(); // Trigger reload
 *   };
 * 
 *   return <button onClick={handleUpdate}>Update</button>;
 * }
 * ```
 */
export function useReloadView() {
    const reloadView = () => {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('taskTableReload'));
        }
    };

    return reloadView;
}
