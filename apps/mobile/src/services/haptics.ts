import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Central haptic language for the whole app (Phase 5).
 *
 * Call by *meaning*, never by raw intensity, so feedback stays consistent:
 *   selection — discrete choice changed (tab, filter, segment, status row)
 *   light     — ordinary primary tap / button
 *   medium    — drag pickup or a meaningful structural change
 *   success   — a save/create/check-in/completion succeeded
 *   warning   — a destructive confirmation is being requested
 *   error     — an operation failed
 *
 * Rules enforced by convention:
 *   • never fire success just to open a menu
 *   • never fire during ordinary scrolling or background refresh
 *   • optional haptics respect the user setting below
 *   • everything no-ops safely on web / unsupported devices
 */

const STORAGE_KEY = "@trava_haptics_enabled";

let enabled = true; // optimistic default; hydrated from storage on init

/** Load the persisted preference once at startup. Safe to call repeatedly. */
export async function initHaptics(): Promise<void> {
    try {
        const v = await AsyncStorage.getItem(STORAGE_KEY);
        if (v === "false") enabled = false;
        else if (v === "true") enabled = true;
    } catch {
        // ignore — keep default
    }
}

export function getHapticsEnabled(): boolean {
    return enabled;
}

export async function setHapticsEnabled(next: boolean): Promise<void> {
    enabled = next;
    try {
        await AsyncStorage.setItem(STORAGE_KEY, next ? "true" : "false");
    } catch {
        // ignore persistence failure; in-memory value still applies
    }
}

function run(fn: () => Promise<unknown>) {
    if (Platform.OS === "web" || !enabled) return;
    try {
        fn().catch(() => {});
    } catch {
        // ignore
    }
}

export const haptics = {
    selection: () => run(() => Haptics.selectionAsync()),
    light: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
    medium: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
    heavy: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
    success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
    warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
    error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};

export type HapticKind = "selection" | "light" | "medium" | "success" | "warning" | "error";

export function triggerHaptic(kind: HapticKind) {
    haptics[kind]();
}

export default haptics;
