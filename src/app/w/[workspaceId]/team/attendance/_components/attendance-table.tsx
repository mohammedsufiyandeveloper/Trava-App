"use client";

import { useEffect, useState, useMemo } from "react";
import { DataTable } from "@/components/data-table/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, Calendar } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useMounted } from "@/hooks/use-mounted";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AttendanceRecord {
    id: string;
    date: string;
    checkIn: string;
    checkOut: string | null;
    status: string;
    checkInLatitude: number | null;
    checkInLongitude: number | null;
    checkOutLatitude: number | null;
    checkOutLongitude: number | null;
    WorkspaceMember: {
        user: {
            name: string;
            surname: string | null;
            email: string;
            image: string | null;
        };
    };
}

export function AttendanceTable({ workspaceId }: { workspaceId: string }) {
    const [loading, setLoading] = useState(true);
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const mounted = useMounted();

    useEffect(() => {
        const fetchRecords = async () => {
            try {
                const res = await fetch(`/api/v1/attendance`, {
                    headers: { "x-workspace-id": workspaceId }
                });
                const data = await res.json();
                if (data.success) {
                    setRecords(data.data);
                }
            } catch (error) {
                console.error("Failed to fetch attendance records:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchRecords();
    }, [workspaceId]);

    const columns = useMemo<ColumnDef<AttendanceRecord>[]>(() => [
        {
            id: "userName",
            accessorKey: "WorkspaceMember.user.name",
            header: "Member",
            cell: ({ row }) => {
                const user = row.original.WorkspaceMember.user;
                return (
                    <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 border border-border/50">
                            <AvatarImage src={user.image || ""} />
                            <AvatarFallback className="bg-primary/5 text-[10px] text-primary">
                                {(user.name?.[0] || "") + (user.surname?.[0] || "")}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                            <span className="text-sm font-medium leading-none mb-1">
                                {user.surname}
                            </span>
                            <span className="text-xs text-muted-foreground truncate max-w-[140px]">
                                {user.email}
                            </span>
                        </div>
                    </div>
                );
            },
        },
        {
            accessorKey: "date",
            header: "Date",
            cell: ({ row }) => {
                if (!mounted) return "...";
                return (
                    <div className="font-medium">
                        {format(new Date(row.original.date), "dd/MM/yyyy")}
                    </div>
                );
            },
        },
        {
            accessorKey: "checkIn",
            header: "Check In",
            cell: ({ row }) => {
                if (!mounted) return "...";
                return (
                    <div className="flex flex-col items-start">
                        <div className="flex items-center gap-1.5 text-sm">
                            <Clock className="h-3 w-3 text-emerald-500" />
                            {format(new Date(row.original.checkIn), "hh:mm a")}
                        </div>
                    </div>
                );
            },
        },
        {
            id: "inLocation",
            header: "In Location",
            cell: ({ row }) => {
                const lat = row.original.checkInLatitude;
                const lng = row.original.checkInLongitude;
                if (!lat || !lng) return <div className="text-xs text-muted-foreground italic">None</div>;
                return (
                    <div className="flex justify-start">
                        <a
                            href={`https://www.google.com/maps?q=${lat},${lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[10px] text-primary hover:underline bg-primary/5 px-2 py-1 rounded"
                            title={`Raw coordinates: ${lat}, ${lng}`}
                        >
                            <MapPin className="h-3 w-3" />
                            {lat.toFixed(6)}, {lng.toFixed(6)}
                        </a>
                    </div>
                );
            },
        },
        {
            accessorKey: "checkOut",
            header: "Check Out",
            cell: ({ row }) => {
                if (!mounted) return "...";
                const checkOut = row.original.checkOut;
                if (!checkOut) return <div className="text-xs text-muted-foreground italic">—</div>;
                return (
                    <div className="flex flex-col items-start">
                        <div className="flex items-center gap-1.5 text-sm">
                            <Clock className="h-3 w-3 text-rose-500" />
                            {format(new Date(checkOut), "hh:mm a")}
                        </div>
                    </div>
                );
            },
        },
        {
            id: "outLocation",
            header: "Out Location",
            cell: ({ row }) => {
                const lat = row.original.checkOutLatitude;
                const lng = row.original.checkOutLongitude;
                if (!lat || !lng) return <div className="text-xs text-muted-foreground italic">None</div>;
                return (
                    <div className="flex justify-start">
                        <a
                            href={`https://www.google.com/maps?q=${lat},${lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[10px] text-primary hover:underline bg-primary/5 px-2 py-1 rounded"
                            title={`Raw coordinates: ${lat}, ${lng}`}
                        >
                            <MapPin className="h-3 w-3" />
                            {lat.toFixed(6)}, {lng.toFixed(6)}
                        </a>
                    </div>
                );
            },
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => {
                const status = row.original.status;
                let content;
                switch (status) {
                    case "PRESENT":
                        content = <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20">Present</Badge>;
                        break;
                    case "ABSENT":
                        content = <Badge variant="destructive">Absent</Badge>;
                        break;
                    case "LATE":
                        content = <Badge className="bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-amber-500/20">Late</Badge>;
                        break;
                    default:
                        content = <Badge variant="outline">{status}</Badge>;
                }
                return <div className="flex justify-start">{content}</div>;
            },
        },
    ], [mounted]);

    const filterFields = [
        {
            label: "Status",
            value: "status",
            options: [
                { label: "Present", value: "PRESENT" },
                { label: "Absent", value: "ABSENT" },
                { label: "Late", value: "LATE" },
            ],
        },
    ];

    if (!mounted) return null;

    return (
        <Card className="border-border/50 shadow-sm backdrop-blur-sm bg-card/50">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    Workspace Logs
                </CardTitle>
            </CardHeader>
            <CardContent>
                <DataTable
                    columns={columns}
                    data={records}
                    isLoading={loading}
                    searchKey="userName"
                    searchPlaceholder="Search members..."
                    filterFields={filterFields}
                />
            </CardContent>
        </Card>
    );
}
