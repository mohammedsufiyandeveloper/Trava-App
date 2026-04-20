import { STATUS_LABELS } from "@/lib/zodSchemas";

type TaskStatus = "TO_DO" | "IN_PROGRESS" | "REVIEW" | "HOLD" | "COMPLETED" | "CANCELLED";

export interface StatusColors {
    color: string;
    bgColor: string;
    borderColor: string;
}

export const STATUS_COLORS: Record<TaskStatus, StatusColors> = {
    TO_DO: {
        color: "text-slate-700",
        bgColor: "bg-slate-50",
        borderColor: "border-slate-200",
    },
    IN_PROGRESS: {
        color: "text-blue-700",
        bgColor: "bg-blue-50",
        borderColor: "border-blue-200",
    },
    REVIEW: {
        color: "text-amber-700",
        bgColor: "bg-amber-50",
        borderColor: "border-amber-200",
    },
    HOLD: {
        color: "text-purple-700",
        bgColor: "bg-purple-50",
        borderColor: "border-purple-200",
    },
    COMPLETED: {
        color: "text-green-700",
        bgColor: "bg-green-50",
        borderColor: "border-green-200",
    },
    CANCELLED: {
        color: "text-red-700",
        bgColor: "bg-red-50",
        borderColor: "border-red-200",
    },
};

// Re-export STATUS_LABELS for backward compatibility
export { STATUS_LABELS };

export function getStatusColors(status: string | null | undefined): StatusColors {
    if (!status) {
        return {
            color: "text-muted-foreground",
            bgColor: "bg-muted",
            borderColor: "border-muted",
        };
    }

    return STATUS_COLORS[status as TaskStatus] || {
        color: "text-muted-foreground",
        bgColor: "bg-muted",
        borderColor: "border-muted",
    };
}

export function getStatusLabel(status: string | null | undefined): string {
    if (!status) return "-";
    return STATUS_LABELS[status as TaskStatus] || status;
}
