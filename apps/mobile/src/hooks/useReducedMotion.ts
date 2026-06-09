import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * Tracks the OS "Reduce Motion" accessibility preference and keeps it live.
 *
 * Animations should degrade gracefully when this is true: skip decorative
 * entrances/shimmer, and cross-fade instead of large translations. Functional
 * feedback (e.g. a press scale) can remain but should be minimal.
 */
export function useReducedMotion(): boolean {
    const [reduced, setReduced] = useState(false);

    useEffect(() => {
        let mounted = true;

        AccessibilityInfo.isReduceMotionEnabled()
            .then((enabled) => {
                if (mounted) setReduced(enabled);
            })
            .catch(() => {});

        const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => {
            setReduced(enabled);
        });

        return () => {
            mounted = false;
            sub.remove();
        };
    }, []);

    return reduced;
}

export default useReducedMotion;
