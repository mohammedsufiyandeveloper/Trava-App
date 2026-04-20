import { QuickCreateSubTask } from "./quick-create-subtask";

interface Props {
    workspaceId: string;
}

export function QuickCreateSubTaskAsync({ workspaceId }: Props) {
    return (
        <QuickCreateSubTask workspaceId={workspaceId} />
    );
}

export function QuickCreateSubTaskSkeleton() {
    return (
        <div className="h-9 w-full rounded-md bg-sidebar-accent/50 animate-pulse" />
    );
}

