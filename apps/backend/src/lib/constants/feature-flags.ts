/**
 * Feature Flags Configuration — release-core-v1
 * 
 * This file controls which modules are enabled in the current release.
 * Procurement, Inventory, and Purchase Orders are disabled for the initial
 * core release (v1). Their code remains in the codebase (actions, data, schemas)
 * but the page routes and navigation links have been removed.
 * 
 * ⚠️  IMPORTANT: When merging from main, use `git checkout --ours` 
 *     for this file to prevent accidental re-enabling of modules.
 * 
 * Database tables for disabled modules are preserved — no data loss.
 * 
 * @see .github/CODEOWNERS for merge protection rules
 */

export const FEATURES = {
    /** Core modules — enabled in release-core-v1 */
    WORKSPACE: true,
    PROJECT_MANAGEMENT: true,
    TASK_MANAGEMENT: true,

    /** Phase 2 modules — disabled in release-core-v1 */
    PROCUREMENT: false,
    INVENTORY: false,
    PURCHASE_ORDERS: false,
} as const;

export type FeatureKey = keyof typeof FEATURES;

/**
 * Check if a feature is enabled in the current release
 * 
 * @example
 * ```ts
 * import { isFeatureEnabled } from '@/lib/constants/feature-flags';
 * 
 * if (isFeatureEnabled('PROCUREMENT')) {
 *   // Show procurement UI
 * }
 * ```
 */
export const isFeatureEnabled = (key: FeatureKey): boolean => FEATURES[key];

/**
 * Get all enabled feature keys
 */
export const getEnabledFeatures = (): FeatureKey[] =>
    (Object.keys(FEATURES) as FeatureKey[]).filter((key) => FEATURES[key]);

/**
 * Get all disabled feature keys  
 */
export const getDisabledFeatures = (): FeatureKey[] =>
    (Object.keys(FEATURES) as FeatureKey[]).filter((key) => !FEATURES[key]);
