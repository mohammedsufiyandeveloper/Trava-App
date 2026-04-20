// NavWorkspacesSelector.tsx
"use client";

import React, { useMemo, useTransition, useRef, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "../../../../../components/ui/sidebar";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useMounted } from "@/hooks/use-mounted";
import type { WorkspacesType } from "@/data/workspace/get-workspaces";

interface Props {
  // matches your getWorkspaces() return: WorkspacesResult
  data: WorkspacesType;
  workspaceId: string;
}

export const NavWorkspacesSelector: React.FC<Props> = ({ data, workspaceId }) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const navigatingTo = useRef<string | null>(null);
  const mounted = useMounted();

  const workspaces = data?.workspaces ?? []; // array of workspace items
  // find current workspace item from workspaceId or default to first item
  const selected = useMemo(() => {
    if (!workspaces || workspaces.length === 0) return undefined;
    return (
      workspaces.find((w) => w.id === workspaceId) ??
      workspaces[0]
    );
  }, [workspaces, workspaceId]);

  useEffect(() => {
    if (!isPending) {
      navigatingTo.current = null;
    }
  }, [isPending]);

  const onWorkspaceSelect = (targetWorkspaceId: string) => {
    if (targetWorkspaceId === workspaceId || isPending || navigatingTo.current === targetWorkspaceId) return; // Already on this workspace or switching
    navigatingTo.current = targetWorkspaceId;
    startTransition(() => {
      router.push(`/w/${targetWorkspaceId}`);
    });
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        {mounted && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className={`data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground ${isPending ? 'opacity-60' : ''}`}
              >
                {isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarFallback className="rounded-lg bg-primary text-primary-foreground">
                      {(selected?.name ?? selected?.id ?? "W").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                )}

                <div className="flex flex-col ml-2">
                  <div className="font-semibold text-muted-foreground">
                    {isPending ? "Switching..." : (selected?.name ?? "No Workspaces")}
                  </div>
                </div>
                <ChevronsUpDown className="ml-auto" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
              align="start"
              sideOffset={5}
            >
              {!workspaces.length && <DropdownMenuItem>No workspaces</DropdownMenuItem>}

              {workspaces.map((ws) => {
                const routeKey = ws.id;
                return (
                  <DropdownMenuItem
                    key={ws.id}
                    onClick={() => onWorkspaceSelect(routeKey)}
                    disabled={isPending}
                  >
                    <div className="flex flex-row items-center gap-2">
                      <Avatar className="h-8 w-8 rounded-lg">
                        {/* No external avatar, fallback to initials using Tailwind CSS */}
                        <AvatarFallback className="rounded-lg bg-primary text-primary-foreground">
                          {(ws.name ?? ws.id ?? "W").charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col ml-2">
                        <div className="font-semibold text-muted-foreground">
                          {ws.name ?? ws.id}
                        </div>
                      </div>
                    </div>
                    {routeKey === workspaceId && <Check className="ml-auto" />}
                  </DropdownMenuItem>
                );
              })}

            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </SidebarMenuItem>
    </SidebarMenu>
  );
};

export default NavWorkspacesSelector;
