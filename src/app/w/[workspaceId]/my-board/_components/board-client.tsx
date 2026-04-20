"use client";

import { useState } from "react";
import { BoardData } from "@/data/board/get-board-data";
import { MemberBoardCard } from "./member-board-card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { createBoardItem } from "@/actions/board/board-actions";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface BoardClientProps {
    data: BoardData;
    workspaceId: string;
}

export default function BoardClient({ data, workspaceId }: BoardClientProps) {
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
    const [newNote, setNewNote] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const openAddModal = (memberId?: string) => {
        setSelectedMemberId(memberId ?? data.currentMemberId ?? null);
        setIsAddModalOpen(true);
    };

    const handleAddNote = async () => {
        if (!newNote.trim() || !selectedMemberId) return;

        setIsSubmitting(true);
        const result = await createBoardItem(workspaceId, selectedMemberId, newNote);

        if (result.status === "success") {
            toast.success("Note added");
            setNewNote("");
            setIsAddModalOpen(false);
        } else {
            toast.error(result.message);
        }
        setIsSubmitting(false);
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    {/* <div className="h-12 w-1.5 bg-primary rounded-full" /> */}
                    <div className="flex flex-col">
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-semibold text-foreground">
                                Workspace board
                            </h1>
                            {data.isOwner && (
                                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 transition-all py-0.5 px-2 text-[10px] font-medium mt-1">
                                    admin
                                </Badge>
                            )}
                        </div>
                        <p className="text-muted-foreground text-sm mt-1">
                            Team updates and personal focus items
                        </p>
                    </div>
                </div>
                <Button
                    onClick={() => openAddModal()}
                    className="gap-2 shadow-lg shadow-primary/20 h-10 px-4 rounded-lg text-sm transition-all"
                >
                    <Plus className="h-4 w-4" />
                    Add note
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
                {data.members.map((member) => (
                    <MemberBoardCard
                        key={member.id}
                        member={member}
                        currentMemberId={data.currentMemberId}
                        isOwner={data.isOwner}
                        workspaceId={workspaceId}
                        onAddNote={(id) => openAddModal(id)}
                    />
                ))}
            </div>

            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                <DialogContent className="sm:max-w-[425px] border-border/50 bg-background/95 backdrop-blur-xl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-semibold">Add Note</DialogTitle>
                        <DialogDescription className="text-sm text-muted-foreground">
                            Create a new item for {selectedMemberId === data.currentMemberId ? 'yourself' : 'this team member'}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-2">
                        <Textarea
                            placeholder="Type your note here... (e.g. Finish the UI audit, Fix auth bug)"
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                            className="min-h-[140px] resize-none bg-muted/20 border-border/30 focus:border-primary/50 transition-all rounded-xl text-sm"
                            autoFocus
                        />
                    </div>
                    <DialogFooter className="gap-2">
                        <Button
                            variant="ghost"
                            onClick={() => setIsAddModalOpen(false)}
                            disabled={isSubmitting}
                            className="text-sm"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleAddNote}
                            disabled={isSubmitting || !newNote.trim()}
                            className="shadow-md shadow-primary/10 text-sm rounded-lg px-6"
                        >
                            {isSubmitting ? "Adding..." : "Add Note"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
