import * as React from "react";
import { NavUser } from "./footer/nav-user";
import { NavMain } from "./header/nav-main";
import { NavProjectsAsync } from "./projectsList/nav-projects-async";
import { NavWorkspacesSelector } from "./header/nav-workspaces-selector";
import { NavFooter } from "./footer/nav-footer";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuItem } from "@/components/ui/sidebar";
import { WorkspacesType } from "@/data/workspace/get-workspaces";
import { QuickCreateSubTaskAsync } from "./header/quick-create-subtask-async";

interface iAppProps {
  data: WorkspacesType;
  workspaceId: string;
}

/**
 * Main application sidebar component.
 * Organizes navigation into workspaces, main features, projects, and user settings.
 */
export async function AppSidebar({ data, workspaceId, ...props }: React.ComponentProps<typeof Sidebar> & iAppProps) {
  // Navigation items for the main workspace section
  // Navigation items — Procurement, Inventory & Orders are disabled for release-core-v1
  const mainNavItems: Array<{
    title: string;
    url: string;
    icon?: "LayoutDashboard" | "Users" | "CheckSquare" | "Settings";
  }> = [
      { title: "Dashboard", url: `/w/${workspaceId}`, icon: "LayoutDashboard" },
      { title: "Team", url: `/w/${workspaceId}/team`, icon: "Users" },
      { title: "Tasks", url: `/w/${workspaceId}/tasks`, icon: "CheckSquare" },
    ];

  // Determine if the user is the owner of the current workspace
  const currentWorkspace = data.workspaces.find((ws) => ws.id === workspaceId);
  const isOwner = currentWorkspace?.workspaceRole === "OWNER";

  const footerNavItems: Array<{
    title: string;
    url: string;
    icon: "Settings" | "BarChart3" | "LayoutDashboard";
  }> = [
      {
        title: isOwner ? "Member Board" : "My Board",
        url: `/w/${workspaceId}/my-board`,
        icon: "LayoutDashboard"
      },
      { title: "Reports", url: `/w/${workspaceId}/reports`, icon: "BarChart3" },
      { title: "Settings", url: `/w/${workspaceId}/settings`, icon: "Settings" },
    ];

  return (
    <Sidebar collapsible="offcanvas" {...props} className="border-r border-border/50">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <NavWorkspacesSelector data={data} workspaceId={workspaceId} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <NavMain
          items={mainNavItems}
          workspaceId={workspaceId}
          quickCreateButton={
            <QuickCreateSubTaskAsync workspaceId={workspaceId} />
          }
        />

        <NavProjectsAsync workspaceId={workspaceId} />
      </SidebarContent>

      <SidebarFooter className="px-3">
        <NavFooter items={footerNavItems} />
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
