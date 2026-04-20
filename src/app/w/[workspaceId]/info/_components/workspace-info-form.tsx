"use client";

import { toast } from "sonner";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { WorkspaceData } from "@/data/workspace/get-workspace-by-id";
import { updateWorkspaceInfo } from "@/actions/workspace/update-workspace-info";
import { updateWorkspaceInfoSchema, UpdateWorkspaceInfoType } from "@/lib/zodSchemas";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

interface WorkspaceInfoFormProps {
    workspace: WorkspaceData;
}

export function WorkspaceInfoForm({ workspace }: WorkspaceInfoFormProps) {
    const [isPending, setIsPending] = useState(false);
    const router = useRouter();

    const form = useForm<UpdateWorkspaceInfoType>({
        resolver: zodResolver(updateWorkspaceInfoSchema),
        defaultValues: {
            workspaceId: workspace.id,
            name: workspace.name,
            description: workspace.description || "",
            legalName: workspace.legalName || "",
            gstNumber: workspace.gstNumber || "",
            panNumber: workspace.panNumber || "",
            companyType: workspace.companyType || "",
            industry: workspace.industry || "",
            msmeNumber: workspace.msmeNumber || "",
            email: workspace.email || "",
            phone: workspace.phone || "",
            website: workspace.website || "",
            addressLine1: workspace.addressLine1 || "",
            addressLine2: workspace.addressLine2 || "",
            city: workspace.city || "",
            state: workspace.state || "",
            country: workspace.country || "",
            pincode: workspace.pincode || "",
        },
    });

    const onSubmit = async (values: UpdateWorkspaceInfoType) => {
        setIsPending(true);
        try {
            const res = await updateWorkspaceInfo(values);
            if (res.status === "success") {
                toast.success(res.message);
                form.reset(values);
                router.refresh();
            } else {
                toast.error(res.message);
            }
        } catch (error) {
            toast.error("Something went wrong");
        } finally {
            setIsPending(false);
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <div className="flex items-center justify-between">
                    <div className="space-y-2">
                        <h1 className="text-3xl font-bold tracking-tight">Workspace Information</h1>
                        <p className="text-muted-foreground">
                            Update organizational and legal details for {workspace.name}.
                        </p>
                    </div>
                    <Button type="submit" disabled={isPending || !form.formState.isDirty}>
                        {isPending ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            "Save Changes"
                        )}
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* General & Legal Info */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Organization Details</CardTitle>
                            <CardDescription>Basic and legal information</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>
                                            Workspace Name <span className="text-red-500">*</span>
                                        </FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="legalName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>
                                                Legal Entity Name <span className="text-red-500">*</span>
                                            </FormLabel>
                                            <FormControl>
                                                <Input {...field} value={field.value || ""} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="companyType"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>
                                                Company Type <span className="text-red-500">*</span>
                                            </FormLabel>
                                            <FormControl>
                                                <Input {...field} value={field.value || ""} placeholder="e.g. Pvt Ltd" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="industry"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>
                                                Industry <span className="text-red-500">*</span>
                                            </FormLabel>
                                            <FormControl>
                                                <Input {...field} value={field.value || ""} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="msmeNumber"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>
                                                MSME Number <span className="text-red-500">*</span>
                                            </FormLabel>
                                            <FormControl>
                                                <Input {...field} value={field.value || ""} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="gstNumber"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>
                                                GST Number <span className="text-red-500">*</span>
                                            </FormLabel>
                                            <FormControl>
                                                <Input {...field} value={field.value || ""} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="panNumber"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>PAN Number</FormLabel>
                                            <FormControl>
                                                <Input {...field} value={field.value || ""} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Description</FormLabel>
                                        <FormControl>
                                            <Input {...field} value={field.value || ""} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>

                    {/* Contact & Address */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Contact & Location</CardTitle>
                            <CardDescription>Address and communication details</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>
                                                Email <span className="text-red-500">*</span>
                                            </FormLabel>
                                            <FormControl>
                                                <Input {...field} value={field.value || ""} type="email" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="phone"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>
                                                Phone <span className="text-red-500">*</span>
                                            </FormLabel>
                                            <FormControl>
                                                <Input {...field} value={field.value || ""} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <FormField
                                control={form.control}
                                name="website"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Website</FormLabel>
                                        <FormControl>
                                            <Input {...field} value={field.value || ""} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="space-y-4 pt-2">
                                <h4 className="text-sm font-medium text-muted-foreground">Address</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="addressLine1"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>
                                                    Line 1 <span className="text-red-500">*</span>
                                                </FormLabel>
                                                <FormControl>
                                                    <Input {...field} value={field.value || ""} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="addressLine2"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Line 2</FormLabel>
                                                <FormControl>
                                                    <Input {...field} value={field.value || ""} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="city"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>
                                                    City <span className="text-red-500">*</span>
                                                </FormLabel>
                                                <FormControl>
                                                    <Input {...field} value={field.value || ""} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="state"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>
                                                    State <span className="text-red-500">*</span>
                                                </FormLabel>
                                                <FormControl>
                                                    <Input {...field} value={field.value || ""} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="pincode"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>
                                                    Pincode <span className="text-red-500">*</span>
                                                </FormLabel>
                                                <FormControl>
                                                    <Input {...field} value={field.value || ""} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="country"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>
                                                    Country <span className="text-red-500">*</span>
                                                </FormLabel>
                                                <FormControl>
                                                    <Input {...field} value={field.value || ""} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </form>
        </Form>
    );
}
