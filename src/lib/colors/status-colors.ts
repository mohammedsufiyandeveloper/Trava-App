import { STATUS_LABELS } from "@/lib/zodSchemas";

type TaskStatus = "TO_DO" | "IN_PROGRESS" | "REVIEW" | "HOLD" | "COMPLETED" | "CANCELLED";

export interface StatusColors {
    color: string;
    bgColor: string;
    borderColor: string;
    barClass: string;
    hex: string;
}

export const STATUS_COLORS: Record<TaskStatus, StatusColors> = {
    TO_DO: {
        color: "text-slate-600 dark:text-white",
        bgColor: "bg-[#D1D5DB]/20",
        borderColor: "border-[#D1D5DB]/50",
        barClass: "bg-[#D1D5DB] hover:bg-[#D1D5DB]/80 focus:ring-[#D1D5DB]",
        hex: "#D1D5DB",
    },
    IN_PROGRESS: {
        color: "text-[#3B82F6]",
        bgColor: "bg-[#3B82F6]/10",
        borderColor: "border-[#3B82F6]/20",
        barClass: "bg-[#3B82F6] hover:bg-[#3B82F6]/80 focus:ring-[#3B82F6]",
        hex: "#3B82F6",
    },
    REVIEW: {
        color: "text-[#8B5CF6]",
        bgColor: "bg-[#8B5CF6]/10",
        borderColor: "border-[#8B5CF6]/20",
        barClass: "bg-[#8B5CF6] hover:bg-[#8B5CF6]/80 focus:ring-[#8B5CF6]",
        hex: "#8B5CF6",
    },
    HOLD: {
        color: "text-[#F59E0B]",
        bgColor: "bg-[#F59E0B]/10",
        borderColor: "border-[#F59E0B]/20",
        barClass: "bg-[#F59E0B] hover:bg-[#F59E0B]/80 focus:ring-[#F59E0B]",
        hex: "#F59E0B",
    },
    COMPLETED: {
        color: "text-[#22C55E]",
        bgColor: "bg-[#22C55E]/10",
        borderColor: "border-[#22C55E]/20",
        barClass: "bg-[#22C55E] hover:bg-[#22C55E]/80 focus:ring-[#22C55E]",
        hex: "#22C55E",
    },
    CANCELLED: {
        color: "text-[#EF4444]",
        bgColor: "bg-[#EF4444]/10",
        borderColor: "border-[#EF4444]/20",
        barClass: "bg-[#EF4444] hover:bg-[#EF4444]/80 focus:ring-[#EF4444]",
        hex: "#EF4444",
    },
};

// Re-export STATUS_LABELS for backward compatibility
export { STATUS_LABELS };

export function getStatusColors(status: string | null | undefined): StatusColors {
    const fallback: StatusColors = {
        color: "text-muted-foreground",
        bgColor: "bg-muted",
        borderColor: "border-muted",
        barClass: "bg-muted",
        hex: "#94a3b8",
    };

    if (!status) return fallback;

    return STATUS_COLORS[status as TaskStatus] || fallback;
}

export function getStatusLabel(status: string | null | undefined): string {
    if (!status) return "-";
    return STATUS_LABELS[status as TaskStatus] || status;
}
