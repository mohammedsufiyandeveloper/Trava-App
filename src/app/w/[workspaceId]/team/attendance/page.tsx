import { Suspense } from "react";
import { AppLoader } from "@/components/shared/app-loader";
import { getWorkspacePermissions } from "@/data/user/get-user-permissions";
import { AttendanceLogger } from "./_components/attendance-logger";
import { AttendanceTable } from "./_components/attendance-table";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LogIn } from "lucide-react";

export const dynamic = "force-dynamic";

interface AttendancePageProps {
    params: Promise<{ workspaceId: string }>;
}

async function AttendanceContent({ workspaceId }: { workspaceId: string }) {
    const permissions = await getWorkspacePermissions(workspaceId);

    return (
        <div className="flex flex-col gap-6">
            {/* The logger component opened via a button as a popup */}
            <div className="flex items-center justify-between bg-card/50 border border-border/50 p-4 rounded-xl backdrop-blur-sm">
                <div className="flex flex-col gap-1">
                    <h2 className="text-sm font-semibold">Daily Attendance</h2>
                    <p className="text-xs text-muted-foreground">Mark your presence for today with geolocation</p>
                </div>
                <Dialog>
                    <DialogTrigger asChild>
                        <Button size="sm" className="gap-2">
                            <LogIn className="h-4 w-4" />
                            Mark Attendance
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="p-0 border-none bg-transparent shadow-none max-w-sm">
                        <AttendanceLogger workspaceId={workspaceId} />
                    </DialogContent>
                </Dialog>
            </div>
            
            {permissions.isWorkspaceAdmin && (
                <AttendanceTable workspaceId={workspaceId} />
            )}
        </div>
    );
}

export default async function AttendancePage({ params }: AttendancePageProps) {
    const { workspaceId } = await params;

    return (
        <div className="w-full">
            <Suspense fallback={<AppLoader />}>
                <AttendanceContent workspaceId={workspaceId} />
            </Suspense>
        </div>
    );
}
