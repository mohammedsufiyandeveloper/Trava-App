"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

interface ReloadableViewProps {
    children: React.ReactNode;
    skeleton?: React.ReactNode;
}

/**
 * Reloadable View Wrapper
 * 
 * Listens for 'taskTableReload' events and refreshes the view.
 * This component can be used across all views (List, Kanban, Gantt, Dashboard)
 * to provide a consistent reload experience.
 * 
 * Usage:
 * ```tsx
 * <ReloadableView skeleton={<YourSkeleton />}>
 *   <YourViewComponent />
 * </ReloadableView>
 * ```
 * 
 * To trigger a reload from anywhere:
 * ```tsx
 * window.dispatchEvent(new Event('taskTableReload'));
 * ```
 */
export function ReloadableView({ children, skeleton }: ReloadableViewProps) {
    const [isReloading, setIsReloading] = useState(false);
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    useEffect(() => {
        const handleReload = () => {
            setIsReloading(true);

            startTransition(() => {
                router.refresh();
                setIsReloading(false);
            });
        };

        window.addEventListener('taskTableReload', handleReload);

        return () => {
            window.removeEventListener('taskTableReload', handleReload);
        };
    }, [router]);

    if (isReloading || isPending) {
        return <>{skeleton}</>;
    }

    return <>{children}</>;
}
