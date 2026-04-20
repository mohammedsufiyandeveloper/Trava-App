import { WorkspaceFullSkeleton } from "../_components/workspace-skeleton";

/** 
 * Root Workspace Loading UI.
 * Shown instantly by Next.js during transitions to any workspace route.
 */
export default function WorkspaceLoading() {
    return <WorkspaceFullSkeleton />;
}
