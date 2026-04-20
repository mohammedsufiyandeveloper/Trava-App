"use client";

import {
  LayoutDashboard,
  Users,
  CheckSquare,
  Settings,
  BarChart3
} from "lucide-react";
import { SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuButton, SidebarMenuItem, } from "@/components/ui/sidebar"
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition, useRef, useEffect } from "react";

// Icon mapping to resolve string names to actual components
const iconMap = {
  LayoutDashboard,
  Users,
  CheckSquare,
  Settings,
  BarChart3
} as const;

type IconName = keyof typeof iconMap;

/**
 * Main navigation items for the workspace sidebar.
 * Includes a Quick Create button and links to key workspace features.
 */
export function NavMain({
  items,
  workspaceId,
  quickCreateButton,
}: {
  items: {
    title: string
    url: string
    icon?: IconName
  }[]
  workspaceId: string
  quickCreateButton?: React.ReactNode
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const navigatingTo = useRef<string | null>(null);

  // Clear navigating ref when transition ends or path changes
  useEffect(() => {
    if (!isPending) {
      navigatingTo.current = null;
    }
  }, [isPending, pathname]);

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, url: string) => {
    e.preventDefault();
    if (isPending || pathname === url || navigatingTo.current === url) return;

    navigatingTo.current = url;
    startTransition(() => {
      router.push(url);
    });
  };

  return (
    <SidebarGroup className={isPending ? "opacity-70 pointer-events-none" : ""}>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          <SidebarMenuItem>
            {quickCreateButton}
          </SidebarMenuItem>
        </SidebarMenu>

        <div className="mt-4">
          <SidebarMenu>
            {items.map((item) => {
              // Dashboard should only be active on exact match, others include nested routes
              const isActive = item.title === "Dashboard"
                ? pathname === item.url
                : pathname === item.url || pathname.startsWith(item.url + '/');
              const IconComponent = item.icon ? iconMap[item.icon] : null;

              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    tooltip={item.title}
                    asChild
                    isActive={isActive}
                    className="transition-all duration-200 hover:bg-accent hover:text-accent-foreground"
                    disabled={isPending}
                  >
                    <Link
                      href={item.url}
                      prefetch={false}
                      className="flex items-center gap-2"
                      onClick={(e) => handleLinkClick(e, item.url)}
                    >
                      <div className="flex-shrink-0">
                        {IconComponent && <IconComponent size={16} strokeWidth={1.5} />}
                      </div>
                      <span className="font-medium">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </div>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
