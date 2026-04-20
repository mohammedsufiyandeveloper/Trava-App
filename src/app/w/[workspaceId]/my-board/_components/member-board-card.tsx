"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Plus, Trash2 } from "lucide-react"
import { BoardData } from "@/data/board/get-board-data"
import { toggleBoardItemStatus, deleteBoardItem } from "@/actions/board/board-actions"
import { toast } from "sonner"
import { useState } from "react"
import { cn } from "@/lib/utils"

type Member = BoardData["members"][0];

interface MemberBoardCardProps {
    member: Member;
    currentMemberId?: string | null;
    isOwner: boolean;
    workspaceId: string;
    onAddNote: (memberId: string) => void;
}

export function MemberBoardCard({ member, currentMemberId, isOwner, workspaceId, onAddNote }: MemberBoardCardProps) {
    const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

    const handleToggle = async (itemId: string, status: any) => {
        setLoadingStates(prev => ({ ...prev, [itemId]: true }));
        const result = await toggleBoardItemStatus(workspaceId, itemId, status);
        if (result.status === "error") {
            toast.error(result.message);
        }
        setLoadingStates(prev => ({ ...prev, [itemId]: false }));
    };

    const handleDelete = async (itemId: string) => {
        if (!confirm("Are you sure you want to delete this note?")) return;

        const result = await deleteBoardItem(workspaceId, itemId);
        if (result.status === "error") {
            toast.error(result.message);
        } else {
            toast.success("Note deleted");
        }
    };

    const isSelf = member.id === currentMemberId;
    const canAddNote = isOwner || isSelf;

    return (
        <Card className="bg-card/40 border-border/50 overflow-hidden group hover:bg-card/60 transition-colors duration-300">
            <CardHeader className="p-2 pb-0">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border border-border/50 ring-2 ring-transparent group-hover:ring-primary/20 transition-all">
                            <AvatarImage src={member.user?.image ?? ""} />
                            <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold uppercase">
                                {member.user?.surname?.[0]}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                            <h3 className="text-base font-medium text-foreground leading-tight">
                                {member.user?.surname}
                            </h3>
                            <span className="text-xs text-muted-foreground font-normal">
                                {member.workspaceRole.replace("_", " ").toLowerCase()}
                            </span>
                        </div>
                    </div>
                    {canAddNote && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-3 text-xs font-medium gap-1.5 border-border/50 hover:bg-primary/10 hover:text-primary transition-all"
                            onClick={() => onAddNote(member.id)}
                        >
                            <Plus className="h-4 w-4" />
                            Note
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="p-4 pt-2 flex flex-col gap-3">
                <div className="h-px bg-gradient-to-r from-border/50 via-border/20 to-transparent mb-1" />
                {member.boardItems.length === 0 ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-2 opacity-40">
                        <div className="h-8 w-8 rounded-full border border-dashed border-muted-foreground/50" />
                        <span className="text-[11px] font-medium italic">No notes assigned yet</span>
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        {member.boardItems.map((item) => {
                            const isDone = item.status === "DONE";
                            const assignerName = item.assignedById === member.id ? "Self" : item.assignedBy?.user?.name;

                            const assignerRole = item.assignedBy?.workspaceRole;
                            const isAdminNote = assignerRole === "OWNER" || assignerRole === "ADMIN";

                            // Permission: Admins can delete anything. 
                            // Members can delete notes they created, or notes on their board UNLESS an admin created them.
                            const canDelete = isOwner || (!isAdminNote && (item.assignedById === currentMemberId || isSelf));

                            return (
                                <div
                                    key={item.id}
                                    className={cn(
                                        "flex items-start gap-3 p-3 rounded-xl border transition-all duration-300 group/item relative",
                                        isDone
                                            ? "bg-muted/10 border-transparent opacity-40grayscale-[50%]"
                                            : "bg-accent/20 border-border/20 hover:border-primary/20 hover:bg-accent/40 shadow-sm"
                                    )}
                                >
                                    <Checkbox
                                        checked={isDone}
                                        onCheckedChange={() => handleToggle(item.id, item.status)}
                                        disabled={loadingStates[item.id]}
                                        className="mt-0.5"
                                    />
                                    <div className="flex-1 flex flex-col gap-1 min-w-0">
                                        <p className={cn(
                                            "text-sm leading-normal break-words pr-4",
                                            isDone && "line-through text-muted-foreground/80"
                                        )}>
                                            {item.note}
                                        </p>
                                        <div className="flex items-center justify-between mt-1">
                                            <span className="text-xs text-muted-foreground/60">
                                                By {assignerName}
                                            </span>
                                            {canDelete && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDelete(item.id);
                                                    }}
                                                    className="opacity-0 group-hover/item:opacity-100 hover:text-destructive transition-all p-1 -m-1"
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
