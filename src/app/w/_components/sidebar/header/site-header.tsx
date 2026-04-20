import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Suspense } from "react"
import { getNotificationsAction } from "@/actions/comment"
import ThemeToggle from "../../../../../components/ui/theme-toggle"
import { NotificationCenterWrapper as NotificationCenter } from "./notification-center-wrapper"
import { MarkAttendanceButton } from "./mark-attendance-button"

async function NotificationCenterLoader({ workspaceId }: { workspaceId: string }) {
  const result = await getNotificationsAction(workspaceId, 15, 0)
  return (
    <NotificationCenter
      workspaceId={workspaceId}
      initialUnread={result.unreadNotifications || []}
      initialRead={result.readNotifications || []}
      initialPeopleCount={result.peopleCount || 0}
    />
  )
}

export function SiteHeader({ workspaceId }: { workspaceId: string }) {
  return (
    <header className="sticky top-0 z-[40] w-full flex h-(--header-height) shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium text-foreground">White Tusker</h1>
        <div className="ml-auto flex items-center gap-3">
          <MarkAttendanceButton workspaceId={workspaceId} />
          <Suspense fallback={
            <div className="relative h-9 w-9 rounded-full flex items-center justify-center">
              <div className="h-4 w-4 animate-pulse bg-muted rounded-full" />
            </div>
          }>
            <NotificationCenterLoader workspaceId={workspaceId} />
          </Suspense>
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
