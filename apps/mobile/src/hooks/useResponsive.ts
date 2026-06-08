import { useWindowDimensions } from 'react-native';

// Breakpoints
export const BREAKPOINTS = {
    tablet: 768,
    desktop: 1024,
    desktopLarge: 1440,
};

// Maximum width for content on large screens to prevent extreme stretching
export const MAX_CONTENT_WIDTH = 1200;
export const FORM_MAX_WIDTH = 500;

export function useResponsive() {
    const { width, height } = useWindowDimensions();

    const isMobile = width < BREAKPOINTS.tablet;
    const isTablet = width >= BREAKPOINTS.tablet && width < BREAKPOINTS.desktop;
    const isDesktop = width >= BREAKPOINTS.desktop;

    /**
     * A helper function to return a specific value based on the current device breakpoint.
     * @param mobileValue Value for mobile screens (< 768px)
     * @param tabletValue Value for tablet screens (768px - 1023px)
     * @param desktopValue Value for desktop screens (>= 1024px)
     */
    function value<T>(mobileValue: T, tabletValue: T, desktopValue: T): T {
        if (isDesktop) return desktopValue;
        if (isTablet) return tabletValue;
        return mobileValue;
    }

    return {
        width,
        height,
        isMobile,
        isTablet,
        isDesktop,
        value,
        MAX_CONTENT_WIDTH,
        FORM_MAX_WIDTH,
    };
}
