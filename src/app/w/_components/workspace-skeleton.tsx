import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarGroup, SidebarGroupLabel, SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

export function WorkspaceSidebarSkeleton() {
    return (
        <Sidebar collapsible="offcanvas" className="border-r border-border/50">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <div className="flex items-center gap-2 px-2 py-2">
                            <Skeleton className="h-8 w-8 rounded-lg" />
                            <Skeleton className="h-4 w-24" />
                        </div>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent className="px-2">
                {/* Main Nav Items Skeleton */}
                <SidebarGroup>
                    <SidebarMenu>
                        {Array.from({ length: 3 }).map((_, i) => (
                            <SidebarMenuItem key={i}>
                                <div className="flex items-center gap-2 px-2 py-2">
                                    <Skeleton className="h-4 w-4" />
                                    <Skeleton className="h-4 w-20" />
                                </div>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                </SidebarGroup>

                {/* Projects List Skeleton */}
                <SidebarGroup className="mt-4">
                    <SidebarGroupLabel>
                        <Skeleton className="h-3 w-16" />
                    </SidebarGroupLabel>
                    <SidebarMenu>
                        {Array.from({ length: 4 }).map((_, i) => (
                            <SidebarMenuItem key={i}>
                                <div className="flex items-center gap-2 px-2 py-2">
                                    <Skeleton className="h-4 w-4" />
                                    <Skeleton className="h-4 w-24" />
                                </div>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="px-3">
                <div className="flex items-center gap-2 px-2 py-2">
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-4 w-20" />
                </div>
                <div className="flex items-center gap-2 px-2 py-4 border-t border-border/50">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="flex flex-col gap-1">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-2 w-16" />
                    </div>
                </div>
            </SidebarFooter>
        </Sidebar>
    );
}

export function WorkspaceHeaderSkeleton() {
    return (
        <header className="sticky top-0 z-[40] w-full flex h-(--header-height) shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
            <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
                <Skeleton className="h-8 w-8 rounded-md" />
                <Separator
                    orientation="vertical"
                    className="mx-2 data-[orientation=vertical]:h-4"
                />
                <Skeleton className="h-5 w-32" />
                <div className="ml-auto flex items-center gap-3">
                    <Skeleton className="h-5 w-5 rounded-full" />
                    <Skeleton className="h-5 w-5 rounded-full" />
                </div>
            </div>
        </header>
    );
}

export function WorkspaceContentSkeleton() {
    return (
        <div className="flex flex-1 flex-col p-4 gap-4">
            <div className="flex items-center justify-between mb-4">
                <div className="flex flex-col gap-2">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-64" />
                </div>
                <Skeleton className="h-10 w-32 rounded-md" />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="p-4 border rounded-xl bg-card flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                            <Skeleton className="h-10 w-10 rounded-lg" />
                            <div className="flex flex-col gap-1">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-3 w-16" />
                            </div>
                        </div>
                        <Skeleton className="h-20 w-full rounded-md" />
                        <div className="flex items-center justify-between mt-2">
                            <Skeleton className="h-4 w-12" />
                            <div className="flex -space-x-2">
                                <Skeleton className="h-6 w-6 rounded-full border-2 border-background" />
                                <Skeleton className="h-6 w-6 rounded-full border-2 border-background" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function WorkspaceFullSkeleton() {
    return (
        <SidebarProvider>
            <div className="flex flex-1 flex-col h-screen overflow-hidden">
                <div className="flex flex-1 overflow-hidden">
                    <WorkspaceSidebarSkeleton />
                    <SidebarInset className="m-0 rounded-none bg-background overflow-hidden flex flex-col">
                        <WorkspaceHeaderSkeleton />
                        <WorkspaceContentSkeleton />
                    </SidebarInset>
                </div>
            </div>
        </SidebarProvider>
    );
}
