export const PROJECT_COLORS = [
    "#ef4444", // red-500
    "#f97316", // orange-500
    "#f59e0b", // amber-500
    "#84cc16", // lime-500
    "#22c55e", // green-500
    "#10b981", // emerald-500
    "#06b6d4", // cyan-500
    "#0ea5e9", // sky-500
    "#3b82f6", // blue-500
    "#6366f1", // indigo-500
    "#8b5cf6", // violet-500
    "#d946ef", // fuchsia-500
    "#ec4899", // pink-500
    "#f43f5e", // rose-500
    "#64748b", // slate-500
];

/**
 * Generates a random color from the predefined project colors palette.
 * Use this when creating a new project to assign a default highlight color.
 */
export function generateRandomColor(): string {
    const index = Math.floor(Math.random() * PROJECT_COLORS.length);
    return PROJECT_COLORS[index];
}

/**
 * Generates a random color that is NOT in the usedColors list.
 * If all colors are used, it falls back to a random color from the palette.
 * 
 * @param usedColors - Array of hex color strings already in use
 */
export function getUniqueRandomColor(usedColors: string[] = []): string {
    // Normalize used colors to lowercase for comparison
    const normalizedUsed = new Set(usedColors.map(c => c.toLowerCase()));

    // Find available colors
    const available = PROJECT_COLORS.filter(c => !normalizedUsed.has(c.toLowerCase()));

    if (available.length === 0) {
        // Fallback if all taken: just pick random
        return generateRandomColor();
    }

    const index = Math.floor(Math.random() * available.length);
    return available[index];
}

// Helper to convert HSL to Hex
function hslToHex(h: number, s: number, l: number): string {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Deterministically generates a color based on a string input (e.g. project name or ID).
 * Uses HSL with fixed Saturation (75%) and Lightness (55%) to ensure visibility 
 * in both Light and Dark modes.
 */
export function getColorFromString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash % 360);
    // S=75% (vibrant), L=55% (visible on black & white)
    return hslToHex(h, 75, 55);
}

