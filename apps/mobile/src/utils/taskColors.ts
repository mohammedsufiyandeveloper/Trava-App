export const STATUS_COLORS = {
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
} as const;

/**
 * Get the React Native compatible background color (hex with opacity)
 */
export function getStatusBgColor(status: string | undefined): string {
    const s = (status || "TO_DO") as keyof typeof STATUS_COLORS;
    const config = STATUS_COLORS[s] || STATUS_COLORS.TO_DO;
    const opacity = config.bgColor.split("/")[1] || "100";
    const opacityHex = Math.round((parseInt(opacity.replace("%", "")) / 100) * 255).toString(16).padStart(2, "0");
    return `${config.hex}${opacityHex}`;
}

/**
 * Get the React Native compatible border color (hex with opacity)
 */
export function getStatusBorderColor(status: string | undefined): string {
    const s = (status || "TO_DO") as keyof typeof STATUS_COLORS;
    const config = STATUS_COLORS[s] || STATUS_COLORS.TO_DO;
    const opacity = config.borderColor.split("/")[1] || "100";
    const opacityHex = Math.round((parseInt(opacity.replace("%", "")) / 100) * 255).toString(16).padStart(2, "0");
    return `${config.hex}${opacityHex}`;
}

/**
 * Get the React Native compatible text color
 */
export function getStatusHex(status: string | undefined): string {
    const s = (status || "TO_DO") as keyof typeof STATUS_COLORS;
    const config = STATUS_COLORS[s] || STATUS_COLORS.TO_DO;
    if (s === "TO_DO") return "#475569"; // slate-600
    return config.hex;
}
