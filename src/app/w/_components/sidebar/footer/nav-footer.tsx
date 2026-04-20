"use client";

import { Settings, BarChart3, LayoutDashboard } from "lucide-react";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import Link from "next/link";
import { usePathname } from "next/navigation";

// Icon mapping for footer
const iconMap = {
    Settings,
    BarChart3,
    LayoutDashboard,
} as const;

type IconName = keyof typeof iconMap;

/**
 * Footer navigation items for the workspace sidebar.
 * Used for Settings and other secondary links.
 */
export function NavFooter({
    items,
}: {
    items: {
        title: string
        url: string
        icon: IconName
    }[]
}) {
    const pathname = usePathname();

    return (
        <SidebarMenu>
            {items.map((item) => {
                const isActive = pathname === item.url || pathname.startsWith(item.url + '/');
                const IconComponent = iconMap[item.icon];

                return (
                    <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                            tooltip={item.title}
                            asChild
                            className="transition-all duration-200 hover:bg-accent hover:text-accent-foreground"
                        >
                            <Link href={item.url} className="flex items-center gap-0">
                                <div className="flex-shrink-0">
                                    <IconComponent size={16} strokeWidth={1.5} />
                                </div>
                                <span className="font-medium">{item.title}</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                );
            })}
        </SidebarMenu>
    )
}
