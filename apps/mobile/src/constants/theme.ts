/**
 * Mobile Design System for TravaApp
 * Premium, native-feeling color palette and typography.
 */

export type ThemeColors = {
    background: string;
    surface: string;
    surfaceHighlight: string;
    overlay: string;
    primary: string;
    secondary: string;
    accent: string;
    text: string;
    textMuted: string;
    textDim: string;
    success: string;
    warning: string;
    error: string;
    info: string;
    border: string;
    divider: string;
    activeTab: string;
    borderLight: string;
    // Status specific (aligned with web)
    statusTodo: string;
    statusInProgress: string;
    statusReview: string;
    statusHold: string;
    statusCompleted: string;
    statusCancelled: string;
};

export const DARK_COLORS: ThemeColors = {
    // Backgrounds
    background: "#0f0f0f",    // Deep dark background
    surface: "#1a1a1a",    // Card / surface background
    surfaceHighlight: "#2a2a2a", // Sub-task items / highlighted cards
    overlay: "rgba(0, 0, 0, 0.7)",

    // Brand
    primary: "#fbb54a",    // Brand orange/yellow
    secondary: "#1e1e1e",
    accent: "#fbbf24",

    // Text
    text: "#ffffff",
    textMuted: "#9ca3af",
    textDim: "#6b7280",

    // Status
    success: "#10b981",
    warning: "#f59e0b",
    error: "#ef4444",
    info: "#3b82f6",

    // Misc
    border: "#262626",
    divider: "#262626",
    activeTab: "#3a2505",
    borderLight: "#333333",
    statusTodo: "#D1D5DB",
    statusInProgress: "#3B82F6",
    statusReview: "#8B5CF6",
    statusHold: "#F59E0B",
    statusCompleted: "#22C55E",
    statusCancelled: "#EF4444",
};

export const LIGHT_COLORS: ThemeColors = {
    // Backgrounds
    background: "#f9fafb",    // Gray 50
    surface: "#ffffff",
    surfaceHighlight: "#f3f4f6", // Gray 100
    overlay: "rgba(0, 0, 0, 0.4)",

    // Brand
    primary: "#fbb54a",    // Consistent brand orange/yellow
    secondary: "#f3f4f6",
    accent: "#f59e0b",

    // Text
    text: "#111827",       // Gray 900
    textMuted: "#4b5563",  // Gray 600
    textDim: "#9ca3af",    // Gray 400

    // Status
    success: "#10b981",
    warning: "#f59e0b",
    error: "#ef4444",
    info: "#3b82f6",

    // Misc
    border: "#e5e7eb",     // Gray 200
    divider: "#e5e7eb",
    activeTab: "#fef3c7",
    borderLight: "#f3f4f6",
    statusTodo: "#D1D5DB",
    statusInProgress: "#3B82F6",
    statusReview: "#8B5CF6",
    statusHold: "#F59E0B",
    statusCompleted: "#22C55E",
    statusCancelled: "#EF4444",
};

export const COLORS = DARK_COLORS;

export const SPACING = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 40,
    bottomTabBar: 24, // Minimal padding as the bar is now non-absolute
} as const;

export const BORDER_RADIUS = {
    sm: 6,
    md: 12,
    lg: 16,
    xl: 24,
    full: 999,
} as const;

export const TYPOGRAPHY = {
    h1: { fontSize: 28, fontWeight: "700" as const, lineHeight: 34 },
    h2: { fontSize: 22, fontWeight: "700" as const, lineHeight: 28 },
    h3: { fontSize: 18, fontWeight: "600" as const, lineHeight: 24 },
    body: { fontSize: 14, fontWeight: "400" as const, lineHeight: 20 },
    caption: { fontSize: 12, fontWeight: "400" as const, lineHeight: 16 },
    label: { fontSize: 10, fontWeight: "700" as const, letterSpacing: 1 },
} as const;
