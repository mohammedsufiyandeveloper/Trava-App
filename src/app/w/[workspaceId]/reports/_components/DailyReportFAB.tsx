"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ClipboardList, CheckCircle2 } from "lucide-react";
import { getDailyReportStatus, getDailyReportFormData } from "@/actions/daily-report-actions";
import dynamic from "next/dynamic";

const DailyReportModal = dynamic(() => import("./DailyReportModal").then(mod => mod.DailyReportModal), {
    ssr: false,
});

export function DailyReportFAB({ workspaceId, initialStatus = "LOADING" }: { workspaceId: string, initialStatus?: "SUBMITTED" | "ABSENT" | "NOT_SUBMITTED" | "LOADING" }) {
    const [isOpen, setIsOpen] = useState(false);
    const [status, setStatus] = useState<"SUBMITTED" | "ABSENT" | "NOT_SUBMITTED" | "LOADING">(initialStatus);

    useEffect(() => {
        // Only fetch if initialStatus is LOADING, otherwise trust the server
        if (initialStatus !== "LOADING") return;

        let mounted = true;
        const fetchStatus = async () => {
            try {
                const data = await getDailyReportStatus(workspaceId);
                if (mounted) {
                    setStatus((data.status as "SUBMITTED" | "ABSENT" | "NOT_SUBMITTED") || "NOT_SUBMITTED");
                }
            } catch (error) {
                if (mounted) setStatus("NOT_SUBMITTED");
            }
        };
        fetchStatus();
        return () => { mounted = false; };
    }, [workspaceId]);

    const handleSubmitted = () => {
        setStatus("SUBMITTED");
    };

    return (
        <>
            <div className="fixed bottom-6 right-6 z-50">
                <Button
                    variant={status === "SUBMITTED" ? "outline" : "default"}
                    size="lg"
                    onClick={() => setIsOpen(true)}
                    className="rounded-full shadow-lg gap-2 font-medium"
                >
                    {status === "SUBMITTED" ? (
                        <>
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                            Report Submitted
                        </>
                    ) : (status === "ABSENT" || status === "NOT_SUBMITTED") ? (
                        <>
                            <ClipboardList className="w-5 h-5" />
                            Report Missing
                        </>
                    ) : status === "LOADING" ? (
                        <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin border-muted-foreground mr-2" />
                    ) : (
                        <>
                            <ClipboardList className="w-5 h-5" />
                            Daily report
                        </>
                    )}
                </Button>
            </div>

            {isOpen && (
                <DailyReportModal
                    workspaceId={workspaceId}
                    isOpen={isOpen}
                    onClose={() => setIsOpen(false)}
                    onSubmitted={handleSubmitted}
                />
            )}
        </>
    );
}
