import { Suspense, ReactNode } from "react";
import { AdminActions } from "./_components/admin-actions";
import Link from "next/link";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TeamLayoutProps {
    children: ReactNode;
    params: Promise<{ workspaceId: string }>;
}

export default async function TeamLayout({ children, params }: TeamLayoutProps) {
    const { workspaceId } = await params;

    return (
        <div className="flex flex-col gap-4 sm:gap-5 w-full">
            {/* Common Heading for Team section */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <h1 className="text-2xl font-bold leading-tight tracking-tighter md:text-3xl">
                    Team
                </h1>
                
                {/* Admin actions (Invite button) stream in separately */}
                <Suspense fallback={<div className="h-10 w-32 bg-muted/20 animate-pulse rounded-md" />}>
                    <AdminActions workspaceId={workspaceId} />
                </Suspense>
            </div>

            {/* Navigation Tabs */}
            <div className="w-full border-b pb-2">
                <Tabs defaultValue="members" className="w-[400px]">
                    <TabsList>
                        <TabsTrigger value="members" asChild>
                            <Link href={`/w/${workspaceId}/team`}>Members</Link>
                        </TabsTrigger>
                        <TabsTrigger value="attendance" asChild>
                            <Link href={`/w/${workspaceId}/team/attendance`}>Attendance</Link>
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            {/* Content Area (page.tsx or attendance/page.tsx) */}
            <div className="mt-4">
                {children}
            </div>
        </div>
    );
}
