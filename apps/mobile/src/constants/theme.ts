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

    // --- Trava Liquid Glass tokens ---
    // Background layers (ambient wash behind everything, deepest to shallowest).
    backgroundElevated: string;
    // Solid, ~opaque content surfaces — forms, tables, dense lists, chat bubbles.
    surfaceSolid: string;
    surfaceSolidRaised: string;
    // Glass surfaces — meant to sit over BlurView, not stand alone.
    glassSurface: string;
    glassSurfaceElevated: string;
    glassBorder: string;
    glassHighlight: string; // inner top hairline highlight on glass
    // Text inverse (on top of primary-colored / filled surfaces).
    textInverse: string;
    // Icons default color (distinct from text so icon-only controls stay legible).
    icon: string;
    iconMuted: string;
    // Scrims behind sheets/modals/menus.
    scrim: string;
    scrimStrong: string;
    // Urgency (task due-date pressure) — distinct hue family from status.
    urgencyOverdue: string;
    urgencyDueSoon: string;
    urgencyOnTrack: string;
    // Disabled / focus / validation.
    disabled: string;
    disabledText: string;
    focusRing: string;
    validationError: string;
    validationSuccess: string;
};

/** Ambient gradient stops — low-opacity brand washes, never behind dense content. */
export type AmbientGradient = readonly [string, string, ...string[]];

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

    backgroundElevated: "#141416",
    surfaceSolid: "#171719",
    surfaceSolidRaised: "#1e1e21",
    glassSurface: "rgba(255,255,255,0.06)",
    glassSurfaceElevated: "rgba(255,255,255,0.10)",
    glassBorder: "rgba(255,255,255,0.14)",
    glassHighlight: "rgba(255,255,255,0.16)",
    textInverse: "#1a1a1a",
    icon: "#e5e7eb",
    iconMuted: "#9ca3af",
    scrim: "rgba(8,8,10,0.55)",
    scrimStrong: "rgba(8,8,10,0.78)",
    urgencyOverdue: "#f87171",
    urgencyDueSoon: "#fbbf24",
    urgencyOnTrack: "#34d399",
    disabled: "rgba(255,255,255,0.08)",
    disabledText: "#6b7280",
    focusRing: "#fbb54a",
    validationError: "#f87171",
    validationSuccess: "#34d399",
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

    backgroundElevated: "#f3f1ec",
    surfaceSolid: "#ffffff",
    surfaceSolidRaised: "#ffffff",
    glassSurface: "rgba(255,255,255,0.55)",
    glassSurfaceElevated: "rgba(255,255,255,0.72)",
    glassBorder: "rgba(17,24,39,0.08)",
    glassHighlight: "rgba(255,255,255,0.9)",
    textInverse: "#1a1a1a",
    icon: "#374151",
    iconMuted: "#6b7280",
    scrim: "rgba(17,24,39,0.28)",
    scrimStrong: "rgba(17,24,39,0.5)",
    urgencyOverdue: "#dc2626",
    urgencyDueSoon: "#d97706",
    urgencyOnTrack: "#059669",
    disabled: "rgba(17,24,39,0.06)",
    disabledText: "#9ca3af",
    focusRing: "#d97706",
    validationError: "#dc2626",
    validationSuccess: "#059669",
};

export const COLORS = DARK_COLORS;

/**
 * Ambient gradient washes, keyed by theme — used only behind hero/auth/AI
 * surfaces and selected empty states, always at low opacity, never behind
 * dense content (forms, lists, tables).
 */
export const AMBIENT_GRADIENTS: Record<"dark" | "light", AmbientGradient> = {
    dark: ["#221a0d", "#0f0f0f", "#0a1420"],
    light: ["#fff3dd", "#f9fafb", "#eef4fb"],
};

/** Blur intensity presets (expo-blur `intensity`, 0-100) per elevation. */
export const BLUR_INTENSITY = {
    subtle: 20,
    header: 32,
    sheet: 40,
    overlay: 50,
} as const;

/**
 * Android + low-end fallback: real-time blur is expensive/inconsistent on
 * some Android GPUs, so glass surfaces there lean on a more opaque tinted
 * surface instead of a heavier blur radius. Also used when the caller wants
 * a cheaper glass surface behind long lists.
 */
export const GLASS_FALLBACK_OPACITY = {
    ios: 1,
    android: 0.92,
} as const;

export const SPACING = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 40,
    bottomTabBar: 24, // Minimal padding as the bar is now non-absolute
} as const;

/**
 * Corner radii, tuned to the Home screen's language: pill-soft widgets (lg)
 * inside a large hero card (xl). Raising these propagates the rounder look to
 * every AppCard, sheet, and button in the app.
 */
export const BORDER_RADIUS = {
    sm: 8,
    md: 14,
    lg: 20,
    xl: 28,
    full: 999,
} as const;

/**
 * Plus Jakarta Sans — the app's display/UI typeface. Loaded once in App.tsx.
 *
 * Always pick the face that matches the weight you want and DROP `fontWeight`:
 * with a custom family, Android synthesizes fake bold and iOS can resolve the
 * wrong face when both are set. `fontFamily: FONTS.bold` alone is correct.
 */
export const FONTS = {
    light: "PlusJakartaSans_300Light",
    regular: "PlusJakartaSans_400Regular",
    medium: "PlusJakartaSans_500Medium",
    semibold: "PlusJakartaSans_600SemiBold",
    bold: "PlusJakartaSans_700Bold",
    extrabold: "PlusJakartaSans_800ExtraBold",
} as const;

export const TYPOGRAPHY = {
    h1: { fontSize: 28, fontFamily: FONTS.extrabold, lineHeight: 34, letterSpacing: -0.5 },
    h2: { fontSize: 22, fontFamily: FONTS.bold, lineHeight: 28, letterSpacing: -0.3 },
    h3: { fontSize: 18, fontFamily: FONTS.semibold, lineHeight: 24, letterSpacing: -0.2 },
    body: { fontSize: 14, fontFamily: FONTS.regular, lineHeight: 20 },
    caption: { fontSize: 12, fontFamily: FONTS.regular, lineHeight: 16 },
    label: { fontSize: 10, fontFamily: FONTS.bold, letterSpacing: 1 },
} as const;

/**
 * Motion tokens — one shared set of durations and spring configs so every
 * animation across the app feels like it was tuned by one hand. Always prefer
 * these over ad-hoc numbers. Durations follow the design brief:
 *   press feedback 100–160ms · standard transitions 180–240ms.
 */
export const MOTION = {
    duration: {
        press: 120,   // button press scale settle
        fast: 160,    // small state changes
        base: 220,    // standard transitions
        slow: 320,    // larger surfaces
    },
    spring: {
        snappy: { damping: 18, stiffness: 220, mass: 0.9 },  // taps, toggles, tab indicator
        gentle: { damping: 20, stiffness: 140, mass: 1 },    // sheets / large surfaces
        bouncy: { damping: 12, stiffness: 180, mass: 0.8 },  // playful entrances
    },
    pressScale: 0.97,  // design brief: ~0.97 on press
    stagger: 45,       // delay between sequential entrance items (ms)
} as const;

/**
 * Minimum interactive sizes (iOS HIG / Material both target ~44–48pt).
 * Use TOUCH_TARGET.min for any tappable; add hitSlop when the visual is smaller.
 */
export const TOUCH_TARGET = {
    min: 44,
} as const;

/** Cross-platform elevation presets (iOS shadow + Android elevation). */
export const ELEVATION = {
    none: {
        shadowColor: "transparent",
        shadowOpacity: 0,
        shadowRadius: 0,
        shadowOffset: { width: 0, height: 0 },
        elevation: 0,
    },
    // Softer and more diffuse than a stock material shadow — the Home cards read
    // as barely-lifted paper, and every other surface should match.
    sm: {
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
    },
    md: {
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 5,
    },
    lg: {
        shadowColor: "#000",
        shadowOpacity: 0.14,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 10 },
        elevation: 10,
    },
} as const;

/** Layer ordering so overlapping surfaces never fight over z-order. */
export const Z_INDEX = {
    base: 0,
    card: 1,
    header: 10,
    dropdown: 100,
    fab: 200,
    tabBar: 300,
    sheet: 400,
    sheetBackdrop: 399,
    toast: 500,
    modal: 600,
} as const;
