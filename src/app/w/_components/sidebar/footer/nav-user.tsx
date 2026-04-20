"use client"

import { LayoutDashboard, MoreVertical, LogOut, HomeIcon, Tv2 } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar"
import { authClient } from "@/lib/auth-client"
import Link from "next/link"
import { useSignout } from "@/hooks/use-signout"
import { useMounted } from "@/hooks/use-mounted"

export function NavUser() {
  const { isMobile } = useSidebar()
  const handleSignOut = useSignout();
  const mounted = useMounted();

  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return null;
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        {mounted && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground mt-5"
              >
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={session?.user?.image || ""} alt={session?.user?.name} />
                  <AvatarFallback className="rounded-lg bg-primary text-primary-foreground">
                    {session?.user.name && session.user.name.length > 0
                      ? session.user.name.charAt(0).toLocaleUpperCase()
                      : session?.user.email.charAt(0).toLocaleUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">
                    {session?.user.name && session.user.name.length > 0
                      ? session.user.name
                      : session?.user.email.split("@")[0]}
                  </span>
                  <span className="text-muted-foreground truncate text-xs">
                    {session?.user?.email}
                  </span>
                </div>
                <MoreVertical className="ml-auto size-4" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
              side={isMobile ? "bottom" : "right"}
              align="end"
              sideOffset={4}
            >
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage src={session?.user?.image || ""} alt={session?.user?.name} />
                    <AvatarFallback className="rounded-lg bg-primary text-primary-foreground">
                      {session?.user.name && session.user.name.length > 0
                        ? session.user.name.charAt(0).toLocaleUpperCase()
                        : session?.user.email.charAt(0).toLocaleUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">
                      {session?.user.name && session.user.name.length > 0
                        ? session.user.name
                        : session?.user.email.split("@")[0]}
                    </span>
                    <span className="text-muted-foreground truncate text-xs">
                      {session?.user.email}
                    </span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <Link href="/">
                    <HomeIcon />
                    Homepage
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/admin">
                    <LayoutDashboard />
                    Dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/admin/courses">
                    <Tv2 />
                    Courses
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
                <LogOut />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
