"use client";

import { DataTable } from "@/components/data-table/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { pusherClient } from "@/lib/pusher";
import { useRouter } from "next/navigation";

interface ActivityLog {
    id: string;
    action: string;
    entityType: string | null;
    entityId: string | null;
    metadata: any;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: Date;
    user: {
        name: string;
        email: string;
        image: string | null;
    };
}

const columns: ColumnDef<ActivityLog>[] = [
    {
        accessorKey: "createdAt",
        header: "Time",
        cell: ({ row }) => (
            <div className="text-xs text-muted-foreground whitespace-nowrap">
                {format(new Date(row.original.createdAt), "MMM d, h:mm a")}
            </div>
        )
    },
    {
        accessorKey: "user.name",
        header: "User",
        cell: ({ row }) => (
            <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                    <AvatarImage src={row.original.user.image || ""} />
                    <AvatarFallback className="text-[10px]">{row.original.user.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                    <span className="text-xs font-medium">{row.original.user.name}</span>
                    <span className="text-[10px] text-muted-foreground">{row.original.user.email}</span>
                </div>
            </div>
        )
    },
    {
        accessorKey: "action",
        header: "Action",
        cell: ({ row }) => (
            <Badge variant="outline" className="text-[10px] uppercase font-bold">
                {row.original.action.replace(/_/g, " ")}
            </Badge>
        )
    },
    {
        accessorKey: "metadata",
        header: "Details",
        cell: ({ row }) => {
            const metadata = row.original.metadata;
            if (!metadata) return <span className="text-muted-foreground italic text-xs">No details</span>;

            // Handle legacy/simple structure
            if (metadata.payload) {
                return <span className="text-xs">{JSON.stringify(metadata.payload)}</span>;
            }

            // Handle micro-update/delta structure: { "field": { "from": "...", "to": "..." } }
            return (
                <div className="flex flex-col gap-1">
                    {Object.entries(metadata).map(([field, values]: [string, any]) => (
                        <div key={field} className="text-[10px] flex items-center gap-1">
                            <span className="font-semibold text-primary">{field}:</span>
                            <span className="text-muted-foreground line-through decoration-red-500/50">{String(values.from)}</span>
                            <span>→</span>
                            <span className="text-green-600 font-medium">{String(values.to)}</span>
                        </div>
                    ))}
                </div>
            );
        }
    },
    {
        accessorKey: "ipAddress",
        header: "Source",
        cell: ({ row }) => (
            <div className="text-[10px] text-muted-foreground font-mono">
                {row.original.ipAddress || "system"}
            </div>
        )
    }
];

export function ActivityList({ logs, workspaceId }: { logs: any[]; workspaceId: string }) {
    const router = useRouter();

    // Refresh logic is now handled globally via RealtimeNotificationListener

    return (
        <DataTable 
            columns={columns as any} 
            data={logs} 
            searchKey="action" 
            searchPlaceholder="Filter by action..."
            pageSize={20}
        />
    );
}
