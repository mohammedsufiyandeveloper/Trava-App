"use client";

import { useState, useEffect } from "react";
import { useMounted } from "@/hooks/use-mounted";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { MapPin, LogIn, LogOut, Loader2 } from "lucide-react";
import { format } from "date-fns";

export function AttendanceLogger({ workspaceId }: { workspaceId: string }) {
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState<"IDLE" | "CHECKED_IN" | "CHECKED_OUT">("IDLE");
    const [record, setRecord] = useState<any>(null);
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [locationError, setLocationError] = useState<string | null>(null);
    const mounted = useMounted();

    // Fetch today's initial status on mount
    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const res = await fetch(`/api/v1/attendance/today`, {
                    headers: { "x-workspace-id": workspaceId }
                });
                
                const data = await res.json();
                
                if (data.success && data.data) {
                    setRecord(data.data);
                    if (data.data.checkOut) {
                        setStatus("CHECKED_OUT");
                    } else if (data.data.checkIn) {
                        setStatus("CHECKED_IN");
                    }
                }
            } catch (error) {
                console.error("Failed to fetch attendance status", error);
            }
        };

        fetchStatus();
    }, [workspaceId]);

    const requestLocation = (): Promise<{ lat: number; lng: number }> => {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error("Geolocation is not supported by your browser."));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    });
                },
                (error) => {
                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            reject(new Error("Location access is required to mark attendance. Please allow location access in your browser settings."));
                            break;
                        case error.POSITION_UNAVAILABLE:
                            reject(new Error("Location information is unavailable."));
                            break;
                        case error.TIMEOUT:
                            reject(new Error("Location request timed out."));
                            break;
                        default:
                            reject(new Error("An unknown error occurred while getting location."));
                            break;
                    }
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        });
    };

    const handleAttendanceAction = async (action: "check-in" | "check-out") => {
        setIsLoading(true);
        setLocationError(null);

        try {
            // Force location requirement as requested
            const coords = await requestLocation();
            setLocation(coords);

            const res = await fetch(`/api/v1/attendance/${action}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-workspace-id": workspaceId,
                },
                body: JSON.stringify({
                    latitude: coords.lat,
                    longitude: coords.lng,
                }),
            });

            const data = await res.json();

            if (!data.success) {
                toast.error(data.error || `Failed to ${action.replace("-", " ")}`);
                setIsLoading(false);
                return;
            }

            toast.success(`Successfully ${action === "check-in" ? "checked in" : "checked out"}!`);
            setRecord(data.data);
            setStatus(action === "check-in" ? "CHECKED_IN" : "CHECKED_OUT");
            
        } catch (error: any) {
            console.error(`Attendance ${action} error:`, error);
            setLocationError(error.message);
            toast.error(error.message || `Failed to ${action}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card className="w-full max-w-md">
            <CardHeader>
                <CardTitle>Daily Attendance</CardTitle>
                <CardDescription>
                    Mark your attendance for {mounted ? format(new Date(), "MMMM do, yyyy") : "..."}. 
                    <br />
                    <span className="text-destructive font-medium mt-1 inline-block">
                        Location access is required.
                    </span>
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                {locationError && (
                    <div className="bg-destructive/10 text-destructive px-3 py-2 text-sm rounded-md flex items-start gap-2">
                        <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                        <p>{locationError}</p>
                    </div>
                )}

                {status === "IDLE" && (
                    <Button 
                        size="lg" 
                        onClick={() => handleAttendanceAction("check-in")} 
                        disabled={isLoading}
                        className="w-full gap-2"
                    >
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                        Check In
                    </Button>
                )}

                {status === "CHECKED_IN" && (
                    <div className="space-y-4">
                        <div className="text-sm bg-green-500/10 text-green-700 dark:text-green-400 p-3 rounded-md border border-green-500/20">
                            <strong>Checked In:</strong> {mounted ? format(new Date(record.checkIn), "h:mm a") : "Loading..."}
                        </div>
                        <Button 
                            variant="destructive"
                            size="lg" 
                            onClick={() => handleAttendanceAction("check-out")} 
                            disabled={isLoading}
                            className="w-full gap-2"
                        >
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                            Check Out
                        </Button>
                    </div>
                )}

                {status === "CHECKED_OUT" && (
                    <div className="space-y-2 text-sm">
                        <div className="bg-muted p-3 rounded-md">
                            <strong>Checked In:</strong> {mounted ? format(new Date(record.checkIn), "h:mm a") : "..."}
                        </div>
                        <div className="bg-muted p-3 rounded-md">
                            <strong>Checked Out:</strong> {mounted ? format(new Date(record.checkOut), "h:mm a") : "..."}
                        </div>
                        <div className="text-center text-muted-foreground mt-4 italic">
                            Your attendance for today is completed.
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
