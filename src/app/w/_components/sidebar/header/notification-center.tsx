"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Bell, User, MessageSquare } from "lucide-react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getNotificationsAction, markTaskCommentsReadAction } from "@/actions/comment";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import Link from "next/link";

import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from "@/components/ui/tabs";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { useSubTaskSheet } from "@/contexts/subtask-sheet-context";
import { pubsub, EVENTS } from "@/lib/pubsub";
import { useRouter } from "next/navigation";

export function NotificationCenter({ workspaceId, initialUnread = [], initialRead = [], initialPeopleCount = 0 }: { workspaceId: string, initialUnread?: any[], initialRead?: any[], initialPeopleCount?: number }) {
    const pathname = usePathname();
    const currentSearchParams = useSearchParams();

    const [unreadNotifications, setUnreadNotifications] = useState<any[]>(initialUnread);
    const [readNotifications, setReadNotifications] = useState<any[]>(initialRead);
    const [peopleCount, setPeopleCount] = useState(initialPeopleCount);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState("new");
    const [hasMore, setHasMore] = useState(false);
    const [offset, setOffset] = useState(0);
    const [isPulsing, setIsPulsing] = useState(false);
    const LIMIT = 15;

    const { data: session } = authClient.useSession();

    const { openSubTaskSheetLoading } = useSubTaskSheet();
    const router = useRouter();

    // Listen for Real-time Notifications via PubSub
    useEffect(() => {
        if (!workspaceId) return;

        console.log(`[NOTIF_CENTER] Listening to PubSub for workspace: ${workspaceId}`);
        
        const unsubscribe = pubsub.subscribe(EVENTS.APP_ACTIVITY_LOG, (data: any) => {
            console.log("[NOTIF_CENTER] PubSub message received:", data.action, data);
            
            // Only handle targeted actions
            if (data.action === "COMMENT_CREATED") {
                // Pulse and update if NOT the current user
                if (data.userId !== session?.user?.id) {
                    setPeopleCount(prev => prev + 1);
                    setIsPulsing(true);
                    setTimeout(() => setIsPulsing(false), 2000);
                    if (isOpen) loadNotifications();
                } else {
                    // Self-update: just refresh list if open
                    if (isOpen) loadNotifications();
                }
            }
        });

        return () => {
            unsubscribe();
        };
    }, [workspaceId, session?.user?.id, isOpen]);

    const handleNotificationClick = async (notif: any) => {
        // 1. Instant UI Feedback: Open the sheet in loading state
        openSubTaskSheetLoading();

        // 2. Synchronize URL programmatically
        const params = new URLSearchParams(currentSearchParams.toString());
        params.set("subtask", notif.taskSlug);
        router.push(`${pathname}?${params.toString()}`);

        // 3. Mark as read and close popover
        if (notif.isNew !== false) {
            handleMarkRead(notif.taskId);
        } else {
            setIsOpen(false);
        }
    };

    const loadNotifications = async (isInitial = true) => {
        if (!workspaceId) return;

        if (isInitial) {
            setLoading(true);
            setOffset(0);
        } else {
            setLoadingMore(true);
        }

        const currentOffset = isInitial ? 0 : offset + LIMIT;
        const result = await getNotificationsAction(workspaceId, LIMIT, currentOffset);

        if (result.success) {
            if (isInitial) {
                setUnreadNotifications(result.unreadNotifications || []);
                setReadNotifications(result.readNotifications || []);
                setPeopleCount(result.peopleCount || 0);
            } else {
                // Merge and deduplicate
                setUnreadNotifications(prev => {
                    const existingIds = new Set(prev.map(n => n.taskId));
                    const newUnread = (result.unreadNotifications || []).filter(n => !existingIds.has(n.taskId));
                    return [...prev, ...newUnread];
                });
                setReadNotifications(prev => {
                    const existingIds = new Set(prev.map(n => n.taskId));
                    const newRead = (result.readNotifications || []).filter(n => !existingIds.has(n.taskId));
                    return [...prev, ...newRead];
                });
                setOffset(currentOffset);
            }
            setHasMore(result.hasMore || false);
        }

        setLoading(false);
        setLoadingMore(false);
    };

    const handleMarkRead = async (taskId: string) => {
        // Optimistic UI Update: Move from New to Old
        const target = unreadNotifications.find(n => n.taskId === taskId);
        if (target) {
            setUnreadNotifications(prev => prev.filter(n => n.taskId !== taskId));
            setReadNotifications(prev => [
                { ...target, isNew: false },
                ...prev.slice(0, 14) // Keep history reasonable
            ]);
            setPeopleCount(prev => Math.max(0, prev - 1));
        }

        // Actually mark as read in DB
        markTaskCommentsReadAction(taskId);
        setIsOpen(false);
    };

    // Sync server-provided data if it changes (e.g., after a revalidatePath)
    // We stringify to prevent unnecessary updates if the array reference changes but the content is the same
    useEffect(() => {
        setUnreadNotifications(initialUnread);
        setReadNotifications(initialRead);
        setPeopleCount(initialPeopleCount);
    }, [JSON.stringify(initialUnread), JSON.stringify(initialRead), initialPeopleCount]);

    const hasAnyNotifications = unreadNotifications.length > 0 || readNotifications.length > 0;

    return (
        <Popover open={isOpen} onOpenChange={(open) => {
            setIsOpen(open);
            if (open) loadNotifications();
        }}>
            <PopoverTrigger asChild>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className={cn(
                        "relative h-9 w-9 rounded-full transition-all",
                        isPulsing && "ring-2 ring-primary ring-offset-2 bg-primary/10"
                    )}
                >
                    <Bell className={cn(
                        "h-[18px] w-[18px] transition-transform",
                        isPulsing && "scale-110 text-primary"
                    )} />
                    {peopleCount > 0 && (
                        <Badge
                            variant="destructive"
                            className={cn(
                                "absolute -top-1 -right-1 h-4 min-w-4 p-0 flex items-center justify-center text-[10px] border-2 border-background",
                                isPulsing && "animate-pulse"
                            )}
                        >
                            {peopleCount}
                        </Badge>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-85 p-0 shadow-xl" align="end">
                <div className="flex flex-col h-full max-h-[550px]">
                    <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                        <h3 className="text-sm font-bold">Notifications</h3>
                    </div>

                    <Tabs defaultValue="new" value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <div className="px-4 border-b">
                            <TabsList className="w-full bg-transparent border-none p-0 h-10 gap-4">
                                <TabsTrigger
                                    value="new"
                                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 h-10 text-xs gap-2"
                                >
                                    New
                                    {unreadNotifications.length > 0 && (
                                        <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                                            {unreadNotifications.length}
                                        </span>
                                    )}
                                </TabsTrigger>
                                <TabsTrigger
                                    value="history"
                                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 h-10 text-xs"
                                >
                                    History
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <ScrollArea className="h-[350px]">
                            <TabsContent value="new" className="m-0 focus-visible:outline-none">
                                {loading && unreadNotifications.length === 0 ? (
                                    <div className="p-8 text-center text-xs text-muted-foreground">
                                        Checking for updates...
                                    </div>
                                ) : unreadNotifications.length === 0 ? (
                                    <div className="p-12 text-center">
                                        <MessageSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground/20" />
                                        <p className="text-sm font-medium text-muted-foreground">All caught up!</p>
                                        <p className="text-xs text-muted-foreground/60 mt-1">No unread messages</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col">
                                        {unreadNotifications.map((notif) => (
                                            <div
                                                key={notif.taskId}
                                                className="flex gap-3 p-4 hover:bg-muted/50 transition-colors border-b last:border-0 relative overflow-hidden group cursor-pointer"
                                                onClick={() => handleNotificationClick(notif)}
                                            >
                                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary transform -translate-x-full group-hover:translate-x-0 transition-transform" />
                                                <NotificationItem notif={notif} />
                                            </div>
                                        ))}
                                        {!hasMore && unreadNotifications.length > 0 && (
                                            <div className="p-6 text-center border-t border-dashed">
                                                <p className="text-[10px] uppercase tracking-widest text-muted-foreground/40 font-semibold">
                                                    No comments found
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="history" className="m-0 focus-visible:outline-none">
                                {readNotifications.length === 0 ? (
                                    <div className="p-12 text-center">
                                        <div className="h-8 w-8 mx-auto mb-2 rounded-full bg-muted flex items-center justify-center">
                                            <Bell className="h-4 w-4 text-muted-foreground/30" />
                                        </div>
                                        <p className="text-sm font-medium text-muted-foreground">No history</p>
                                        <p className="text-xs text-muted-foreground/60 mt-1">Recently read items appear here</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col">
                                        {readNotifications.map((notif) => (
                                            <div
                                                key={notif.taskId}
                                                className="flex gap-3 p-4 hover:bg-muted/50 transition-colors border-b last:border-0 opacity-80 cursor-pointer"
                                                onClick={() => handleNotificationClick({ ...notif, isNew: false })}
                                            >
                                                <NotificationItem notif={notif} isRead />
                                            </div>
                                        ))}
                                        {!hasMore && readNotifications.length > 0 && (
                                            <div className="p-6 text-center border-t border-dashed">
                                                <p className="text-[10px] uppercase tracking-widest text-muted-foreground/40 font-semibold">
                                                    No comments found
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </TabsContent>
                        </ScrollArea>
                    </Tabs>

                    {hasMore && (
                        <div className="p-2 border-t text-center bg-muted/5">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="w-full text-xs h-8 text-muted-foreground hover:text-primary"
                                onClick={() => loadNotifications(false)}
                                disabled={loadingMore}
                            >
                                {loadingMore ? "Loading..." : "Load more comments"}
                            </Button>
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}

function NotificationItem({ notif, isRead }: { notif: any, isRead?: boolean }) {
    return (
        <>
            <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={notif.latestComment.user.image} />
                <AvatarFallback><User size={14} /></AvatarFallback>
            </Avatar>
            <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-1 text-[9px] text-muted-foreground uppercase tracking-wider truncate">
                    <span className="truncate max-w-[80px] text-muted-foreground/60">{notif.projectName}</span>
                    <span className="text-muted-foreground/30">/</span>
                    {notif.parentTaskName && (
                        <>
                            <span className="truncate max-w-[60px] text-muted-foreground/60">{notif.parentTaskName}</span>
                            <span className="text-muted-foreground/30">/</span>
                        </>
                    )}
                    <span className={`truncate max-w-[120px] ${isRead ? 'font-medium' : 'font-bold text-primary'}`}>
                        {notif.taskName}
                    </span>
                </div>

                <p className="text-[13px] leading-none py-0.5">
                    <span className="font-semibold">{notif.latestComment.user.name}</span>
                    {notif.count > 1 && (
                        <span className={`ml-2 text-[9px] px-1.5 py-0.5 rounded-full font-bold align-middle ${isRead ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'}`}>
                            +{notif.count - 1} more
                        </span>
                    )}
                </p>

                <p className={`text-xs line-clamp-1 italic ${isRead ? 'text-muted-foreground/70' : 'text-muted-foreground'}`}>
                    "{notif.latestComment.content}"
                </p>

                <p className="text-[9px] text-muted-foreground/60">
                    {formatDistanceToNow(new Date(notif.latestComment.createdAt), { addSuffix: true })}
                </p>
            </div>
        </>
    );
}
