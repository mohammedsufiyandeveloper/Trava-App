"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Upload, X } from "lucide-react";
import { toast } from "sonner";

interface ActivityDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (comment: string, attachment?: File) => void;
    subTaskName: string;
}

export function ActivityDialog({ isOpen, onClose, onSubmit, subTaskName }: ActivityDialogProps) {
    const [comment, setComment] = useState("");
    const [attachment, setAttachment] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Validate file size (max 10MB)
            if (file.size > 10 * 1024 * 1024) {
                toast.error("File size must be less than 10MB");
                return;
            }
            setAttachment(file);
        }
    };

    const handleRemoveAttachment = () => {
        setAttachment(null);
    };

    const handleSubmit = async () => {
        // Validate that at least comment or attachment is provided
        if (!comment.trim() && !attachment) {
            toast.error("Please provide a comment or attachment");
            return;
        }

        setIsSubmitting(true);
        try {
            await onSubmit(comment.trim(), attachment || undefined);
            // Reset form
            setComment("");
            setAttachment(null);
            onClose();
        } catch (error) {
            console.error("Error submitting activity:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancel = () => {
        setComment("");
        setAttachment(null);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Add Activity</DialogTitle>
                    <DialogDescription>
                        Moving <span className="font-semibold text-foreground">{subTaskName}</span> requires an activity note or attachment.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="comment">Activity Note</Label>
                        <Textarea
                            id="comment"
                            placeholder="Add your activity note here..."
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            rows={4}
                            className="resize-none"
                        />
                    </div>

                    {/* Attachment Input */}
                    <div className="space-y-2">
                        <Label>Attachment (Optional)</Label>
                        {attachment ? (
                            <div className="flex items-center gap-2 p-3 border rounded-md bg-muted/50">
                                <div className="flex-1 truncate text-sm">
                                    {attachment.name}
                                    <span className="text-muted-foreground ml-2">
                                        ({(attachment.size / 1024).toFixed(1)} KB)
                                    </span>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleRemoveAttachment}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        ) : (
                            <div className="relative">
                                <input
                                    type="file"
                                    id="attachment"
                                    className="hidden"
                                    onChange={handleFileChange}
                                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => document.getElementById("attachment")?.click()}
                                >
                                    <Upload className="h-4 w-4 mr-2" />
                                    Upload File
                                </Button>
                            </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                            Supported: Images, PDF, Word, Excel (Max 10MB)
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleCancel}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isSubmitting || (!comment.trim() && !attachment)}
                    >
                        {isSubmitting ? "Submitting..." : "To Review"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
