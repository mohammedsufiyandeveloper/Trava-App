"use client";

import Link from "next/link";
import { toast } from "sonner";
import { useState } from "react";
import { EditProjectForm } from "./options/edit-project-form";
import { ManageProjectMembersDialog } from "./options/manage-members-dialog";
import { usePathname, useRouter } from "next/navigation";
import { useTransition, useRef, useEffect } from "react";
import { deleteProject } from "@/actions/project/delete-project";
import type { UserProjectsType } from "@/data/project/get-projects";
import type { WorkspaceMembersResult } from "@/data/workspace/get-workspace-members";
import type { FullProjectData } from "@/data/project/get-full-project-data";
import { getWorkspaceMembersAction } from "@/actions/workspace/get-members";
import { Building2Icon, MoreHorizontal, Eye, Pencil, Trash2, Loader2, Users } from "lucide-react";
import { getFullProjectDataAction } from "@/actions/project/get-full-data";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuAction, useSidebar } from "@/components/ui/sidebar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from "@/components/ui/alert-dialog";
import { CreateProjectForm } from "@/app/w/[workspaceId]/p/_components/create-project-form";
import { useMounted } from "@/hooks/use-mounted";

interface iAppProps {
  projects: UserProjectsType;
  workspaceId: string;
  isAdmin: boolean;
  canCreateProject?: boolean;
  userRole?: string;
  currentUserId?: string;
}

export function NavProjects({ projects, workspaceId, isAdmin, canCreateProject, userRole, currentUserId }: iAppProps) {
  const { isMobile } = useSidebar();
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const navigatingTo = useRef<string | null>(null);
  const mounted = useMounted();

  // Clear navigating ref when transition ends or path changes
  useEffect(() => {
    if (!isPending) {
      navigatingTo.current = null;
    }
  }, [isPending, pathname]);

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, url: string) => {
    e.preventDefault();
    // 1. Block if already navigating OR if isPending
    // 2. Block if already on the target URL (pathname check)
    if (isPending || pathname === url || navigatingTo.current === url) return;

    navigatingTo.current = url;
    startTransition(() => {
      router.push(url);
    });
  };

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<FullProjectData | null>(null);
  const [isLoadingProject, setIsLoadingProject] = useState(false);

  // Manage members dialog state
  const [manageMembersDialogOpen, setManageMembersDialogOpen] = useState(false);
  const [projectToManageMembers, setProjectToManageMembers] = useState<FullProjectData | null>(null);

  // Members list (loaded on demand)
  const [members, setMembers] = useState<WorkspaceMembersResult["workspaceMembers"]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  const loadMembers = async () => {
    if (members.length > 0 || isLoadingMembers) return;
    setIsLoadingMembers(true);
    try {
      const result = await getWorkspaceMembersAction(workspaceId);
      if (result.success && result.data?.workspaceMembers) {
        setMembers(result.data.workspaceMembers);
      } else {
        toast.error("Failed to load workspace members");
      }
    } catch (error) {
      console.error("Error loading members:", error);
      toast.error("An error occurred while loading members");
    } finally {
      setIsLoadingMembers(false);
    }
  };

  const handleDeleteClick = (project: { id: string; name: string }) => {
    setProjectToDelete(project);
    setDeleteDialogOpen(true);
  };

  const handleEditClick = async (projectId: string) => {
    if (isLoadingProject) return;
    setIsLoadingProject(true);
    try {
      const [fullDataResult, membersResult] = await Promise.all([
        getFullProjectDataAction(projectId),
        loadMembers()
      ]);

      if (fullDataResult.success && fullDataResult.data) {
        setProjectToEdit(fullDataResult.data);
        setEditDialogOpen(true);
      } else {
        toast.error(fullDataResult.error || "Failed to load project data");
      }
    } catch (error) {
      console.error("Error loading project:", error);
      toast.error("Failed to load project data");
    } finally {
      setIsLoadingProject(false);
    }
  };

  const handleManageMembersClick = async (projectId: string) => {
    if (isLoadingProject) return;
    setIsLoadingProject(true);
    try {
      const [fullDataResult, membersResult] = await Promise.all([
        getFullProjectDataAction(projectId),
        loadMembers()
      ]);

      if (fullDataResult.success && fullDataResult.data) {
        setProjectToManageMembers(fullDataResult.data);
        setManageMembersDialogOpen(true);
      } else {
        toast.error(fullDataResult.error || "Failed to load project data");
      }
    } catch (error) {
      console.error("Error loading project:", error);
      toast.error("Failed to load project data");
    } finally {
      setIsLoadingProject(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!projectToDelete || isDeleting) return;

    setIsDeleting(true);
    try {
      const result = await deleteProject(projectToDelete.id);

      if (result.status === "success") {
        toast.success(result.message);
        setDeleteDialogOpen(false);
        setProjectToDelete(null);
        router.push(`/w/${workspaceId}`);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error("Failed to delete project");
    } finally {
      setIsDeleting(false);
    }
  };

  const onOpenCreateProject = async () => {
    await loadMembers();
  };

  return (
    <>
      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        <SidebarGroupLabel>
          <div className="flex text-sm items-center justify-between w-full cursor-pointer mb-4" onClick={onOpenCreateProject}>
            <span>Projects</span>
            {mounted && (
              <CreateProjectForm
                members={members}
                workspaceId={workspaceId}
                isAdmin={isAdmin} // Still used?
                canCreateProject={canCreateProject ?? isAdmin} // Fallback to isAdmin if undefined
                userRole={userRole}
                currentUserId={currentUserId}
              />
            )}
          </div>
        </SidebarGroupLabel>
        <SidebarMenu>
          {projects?.map((proj: UserProjectsType[number]) => {
            const href = `/w/${workspaceId}/p/${proj.slug}`;
            const isActive = pathname === href || pathname.startsWith(`${href}/`);

            return (
              <SidebarMenuItem key={proj.id}>
                <SidebarMenuButton asChild disabled={isPending}>
                  <Link
                    href={href}
                    prefetch={false}
                    onClick={(e) => handleLinkClick(e, href)}
                    className={
                      isActive
                        ? "bg-foreground/10 dark:bg-foreground/20 border-foreground/50 hover:bg-foreground/20 dark:hover:bg-foreground/30 text-foreground hover:text-primary"
                        : "text-muted-foreground"
                    }
                  >
                    <Building2Icon style={{ color: proj.color || "currentColor" }} />
                    <span className="truncate">{proj.name}</span>
                  </Link>
                </SidebarMenuButton>

                {/* Action dropdown menu */}
                {mounted && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <SidebarMenuAction>
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">More options</span>
                      </SidebarMenuAction>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="start" className="w-48">
                      {/* View */}
                      <DropdownMenuItem asChild>
                        <Link href={href} className="flex items-center gap-2 cursor-pointer">
                          <Eye className="h-4 w-4" />
                          <span>View Project</span>
                        </Link>
                      </DropdownMenuItem>
  
                      {/* Edit - PROJECT_MANAGER or Admin */}
                      {proj.canManageMembers && (
                        <DropdownMenuItem
                          className="flex items-center gap-2 cursor-pointer"
                          disabled={isLoadingProject}
                          onClick={() => handleEditClick(proj.id)}
                        >
                          {isLoadingProject ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Pencil className="h-4 w-4" />
                          )}
                          <span>{isLoadingProject ? "Loading..." : "Edit Project"}</span>
                        </DropdownMenuItem>
                      )}
  
                      {/* Manage Members - PROJECT_MANAGER or Admin */}
                      {proj.canManageMembers && (
                        <DropdownMenuItem
                          className="flex items-center gap-2 cursor-pointer"
                          disabled={isLoadingProject}
                          onClick={() => handleManageMembersClick(proj.id)}
                        >
                          {isLoadingProject ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Users className="h-4 w-4" />
                          )}
                          <span>{isLoadingProject ? "Loading..." : "Manage Members"}</span>
                        </DropdownMenuItem>
                      )}
  
                      {proj.canManageMembers && (
                        <>
                          <DropdownMenuSeparator />
  
                          {/* Delete - PROJECT_MANAGER or Admin */}
                          <DropdownMenuItem
                            className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
                            onClick={() => handleDeleteClick({ id: proj.id, name: proj.name })}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span>Delete Project</span>
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroup>

      {/* Edit Project Form Dialog */}
      {projectToEdit && (
        <EditProjectForm
          project={projectToEdit}
          members={members}
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) setProjectToEdit(null);
          }}
        />
      )}

      {/* Manage Members Dialog */}
      {projectToManageMembers && (
        <ManageProjectMembersDialog
          open={manageMembersDialogOpen}
          onOpenChange={(open) => {
            setManageMembersDialogOpen(open);
            if (!open) setProjectToManageMembers(null);
          }}
          projectId={projectToManageMembers.id}
          projectName={projectToManageMembers.name}
          currentMembers={
            projectToManageMembers.projectMembers?.map((pm) => ({
              id: pm.id,
              userId: pm.userId,
              userName: pm.userName || "Unknown",
              projectRole: pm.projectRole,
            })) || []
          }
          workspaceMembers={members}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold">{projectToDelete?.name}</span>? This action
              cannot be undone. All tasks and data associated with this project will be
              permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Project"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
