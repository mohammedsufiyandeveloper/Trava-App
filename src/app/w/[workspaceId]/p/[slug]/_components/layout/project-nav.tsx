"use client";

import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, LayoutList, LayoutGrid, GanttChartSquare } from "lucide-react";
import { useTransition } from "react";

interface ProjectNavProps {
    workspaceId: string;
    slug: string;
}

export function ProjectNav({ workspaceId, slug }: ProjectNavProps) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const baseUrl = `/w/${workspaceId}/p/${slug}`;

    const currentView = searchParams.get('view') || 'dashboard';

    const isProjectPage = pathname === baseUrl;

    const viewTabs = [
        {
            name: "Dashboard",
            href: `${baseUrl}?view=dashboard`,
            icon: LayoutDashboard,
            value: "dashboard"
        },
        {
            name: "List",
            href: `${baseUrl}?view=list`,
            icon: LayoutList,
            value: "list"
        },
        {
            name: "Kanban",
            href: `${baseUrl}?view=kanban`,
            icon: LayoutGrid,
            value: "kanban"
        },
        {
            name: "Gantt",
            href: `${baseUrl}?view=gantt`,
            icon: GanttChartSquare,
            value: "gantt"
        },
    ];

    const handleViewChange = (href: string, e: React.MouseEvent) => {
        e.preventDefault();
        if (isPending) return;
        startTransition(() => {
            router.push(href);
        });
    };

    return (
        <div className={cn("border-b", isPending && "opacity-60 pointer-events-none transition-opacity")}>
            <div className="flex h-10 items-center gap-4 overflow-x-auto scrollbar-hide">
                {isProjectPage && viewTabs.map((tab) => {
                    const isActive = currentView === tab.value;
                    const Icon = tab.icon;
                    return (
                        <Link
                            key={tab.href}
                            href={tab.href}
                            prefetch={false}
                            scroll={false}
                            onClick={(e) => handleViewChange(tab.href, e)}
                            className={cn(
                                "flex h-full items-center gap-2 border-b-2 px-2 sm:px-3 text-sm font-medium transition-colors hover:text-primary whitespace-nowrap flex-shrink-0",
                                isActive
                                    ? "border-primary text-primary"
                                    : "border-transparent text-muted-foreground"
                            )}
                        >
                            <Icon className="h-3 w-3" />
                            <span className="text-xs sm:text-xs">{tab.name}</span>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
