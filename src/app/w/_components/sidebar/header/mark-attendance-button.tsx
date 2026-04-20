"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LogIn } from "lucide-react";
import { AttendanceLogger } from "@/app/w/[workspaceId]/team/attendance/_components/attendance-logger";

export function MarkAttendanceButton({ workspaceId }: { workspaceId: string }) {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="hidden sm:flex h-9 gap-2">
                    <LogIn className="h-4 w-4" />
                    <span className="hidden lg:inline">Mark Attendance</span>
                    <span className="inline lg:hidden">Attendance</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="p-0 border-none bg-transparent shadow-none max-w-md w-full">
                <div className="bg-card text-card-foreground shadow-lg sm:rounded-xl overflow-hidden border">
                    <AttendanceLogger workspaceId={workspaceId} />
                </div>
            </DialogContent>
        </Dialog>
    );
}
