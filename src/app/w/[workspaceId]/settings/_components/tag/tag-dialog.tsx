"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { createTag } from "@/actions/tag/create-tag";
import { updateTag } from "@/actions/tag/update-tag";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Tag {
    id: string;
    name: string;
    requirePurchase?: boolean;
}

interface TagDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    workspaceId: string;
    tag?: Tag | null;
    onSuccess?: () => void;
    isWorkspaceAdmin?: boolean;
}



export function TagDialog({ open, onOpenChange, workspaceId, tag, onSuccess, isWorkspaceAdmin = false }: TagDialogProps) {
    const [name, setName] = useState(tag?.name || "");
    const [requirePurchase, setRequirePurchase] = useState(tag?.requirePurchase ?? false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Update form when tag changes
    useEffect(() => {
        if (tag) {
            setName(tag.name);
            // Explicitly handle boolean value - if undefined, default to false
            setRequirePurchase(tag.requirePurchase ?? false);
        } else {
            setName("");
            setRequirePurchase(false);
        }
    }, [tag, open]);

    // Check if any changes were made (for editing mode)
    const hasChanges = tag
        ? name !== tag.name || requirePurchase !== (tag.requirePurchase ?? false)
        : name.trim().length > 0;

    const isButtonDisabled = isSubmitting || !hasChanges || !isWorkspaceAdmin;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isWorkspaceAdmin) return;
        setIsSubmitting(true);

        try {
            const result = tag
                ? await updateTag({ tagId: tag.id, name, requirePurchase, workspaceId })
                : await createTag({ name, requirePurchase, workspaceId });

            if (result.success) {
                toast.success(`Tag "${name}" has been ${tag ? "updated" : "created"} successfully.`);
                onOpenChange(false);
                setName("");
                setRequirePurchase(false);
                onSuccess?.();
            } else {
                toast.error(result.error || "An error occurred");
            }
        } catch (error) {
            toast.error("An unexpected error occurred");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>{tag ? "Edit Tag" : "Create New Tag"}</DialogTitle>
                        <DialogDescription>
                            {tag
                                ? "Update the tag name and purchase requirement."
                                : "Add a new tag to organize your tasks."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Tag Name</Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g., Design, Development"
                                required
                                maxLength={50}
                                disabled={!isWorkspaceAdmin || isSubmitting}
                            />
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="requirePurchase"
                                checked={requirePurchase}
                                onCheckedChange={(checked) => setRequirePurchase(checked as boolean)}
                                disabled={!isWorkspaceAdmin || isSubmitting}
                            />
                            <Label
                                htmlFor="requirePurchase"
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                                Require Purchase
                            </Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isButtonDisabled}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {tag ? "Update" : "Create"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
