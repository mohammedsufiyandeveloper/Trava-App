"use client";

import slugify from "slugify";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTransition, useEffect, useState } from "react";
import { useMounted } from "@/hooks/use-mounted";
import { useRouter } from "next/navigation";
import { tryCatch } from "@/hooks/try-catch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useConfetti } from "@/hooks/use-confetti";
import { Resolver, useForm, useWatch } from "react-hook-form";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { WorkspaceMembersResult } from "@/data/workspace";
import { createProject } from "@/actions/project/create-project";
import { projectSchema, ProjectSchemaType } from "@/lib/zodSchemas";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, Plus, PlusIcon, SparkleIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { generateRandomColor, getColorFromString } from "@/lib/colors/project-colors";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

interface iAppProps {
    members: WorkspaceMembersResult["workspaceMembers"]
    workspaceId: string,
    isAdmin: boolean;
    canCreateProject?: boolean;
    userRole?: string; // Workspace role of current user
    currentUserId?: string; // Current user's ID
}

export const CreateProjectForm = ({ members, workspaceId, isAdmin, canCreateProject, userRole, currentUserId }: iAppProps) => {
    const [pending, startTransition] = useTransition();
    const router = useRouter();
    const { triggerConfetti } = useConfetti();
    const mounted = useMounted();

    // Use explicit permission if provided, otherwise fallback to legacy isAdmin check
    const showCreateButton = canCreateProject ?? isAdmin;

    // Determine if user is MANAGER (auto-assigned as project manager)
    const isManager = userRole === "MANAGER";

    const form = useForm<ProjectSchemaType>({
        resolver: zodResolver(projectSchema) as unknown as Resolver<ProjectSchemaType>,
        defaultValues: {
            name: "",
            description: "",
            slug: "",
            color: generateRandomColor(),
            address: "",
            directorName: "",
            companyName: "",
            registeredCompanyName: "",
            gstNumber: "",
            contactPerson: "",
            phoneNumber: "",
            workspaceId: workspaceId as string,
            // Auto-assign MANAGER as project lead
            projectManagers: isManager ? [currentUserId as string] : [],
            memberAccess: [] as string[],
        },
    })

    const watchedName = useWatch({
        control: form.control,
        name: "name",
    });

    const watchedColor = useWatch({
        control: form.control,
        name: "color",
    });

    const watchedSlug = useWatch({
        control: form.control,
        name: "slug",
    });

    useEffect(() => {
        if (watchedName) {
            const autoColor = getColorFromString(watchedName);
            form.setValue("color", autoColor, { shouldDirty: true });
            const generatedSlug = slugify(watchedName, { lower: true, strict: true });
            form.setValue("slug", generatedSlug, { shouldDirty: true, shouldValidate: true });
        }
    }, [watchedName, form]);

    function onSubmit(data: ProjectSchemaType) {
        if (pending) return;
        startTransition(async () => {
            const { data: result, error } = await tryCatch(createProject(data));
            console.log("results", { result });

            if (error) {
                toast.error(error.message);
                console.error(error);
                return;
            }

            if (result.status === "success") {
                toast.success(result.message);
                triggerConfetti();
                form.reset();
                router.push(`/w/${workspaceId}`);
            } else (
                toast.error(result.message)
            )
        });
    }

    // --- Updated CreateProjectDialog.tsx (JSX / TSX) ---
    return (
        <>
            <Dialog>
                {showCreateButton && mounted && (
                    <DialogTrigger asChild>
                        <button className="cursor-pointer">
                            <Plus size={16} />
                        </button>
                    </DialogTrigger>
                )}
                {/* Make the dialog content scrollable when form grows */}
                <DialogContent className="max-h-[98vh] w-[min(900px,95vw)] overflow-hidden">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3">
                            Create New Project
                            <div
                                className="h-5 w-5 rounded-full border shadow-sm transition-colors"
                                style={{ backgroundColor: watchedColor || "#000000" }}
                            />
                        </DialogTitle>
                    </DialogHeader>

                    {/* The scrollable area. Keeps header/footer sticky if you want:
                        - header is above already; if you want sticky footer, wrap form and footer separately. */}
                    <div className="mt-4 overflow-y-auto px-2 py-1 max-h-[70vh] thin-scrollbar">
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Project Name</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Enter project name" {...field} />
                                            </FormControl>
                                            <input type="hidden" {...form.register("color")} />
                                            <input type="hidden" {...form.register("slug")} />
                                            {watchedSlug && (
                                                <p className="text-[10px] text-muted-foreground mt-1 ml-1">
                                                    Slug: <span className="font-mono">{watchedSlug}</span>
                                                </p>
                                            )}
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {/* Description */}
                                <FormField
                                    control={form.control}
                                    name="description"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Description</FormLabel>
                                            <FormControl>
                                                <Textarea
                                                    {...field}
                                                    placeholder="Project description"
                                                    className="resize-none"
                                                    rows={4}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {/* two-column block */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="companyName"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Company Name</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="e.g. Google" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="registeredCompanyName"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Registered Company Name</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Registered company name" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="directorName"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Director Name</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="eg: John Doe (MD)" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="address"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Address</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="eg:#123, Street name" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <FormField
                                    control={form.control}
                                    name="gstNumber"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>GST Number</FormLabel>
                                            <FormControl>
                                                <Input
                                                    {...field}
                                                    placeholder="12ABCDE3456F7Z8"
                                                    inputMode="text"
                                                    maxLength={15}
                                                />
                                            </FormControl>
                                            <FormDescription className="text-xs text-muted-foreground">
                                                {/* GST is usually 15 characters — alphanumeric. (Add validation in schema) */}
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {/* contact details */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="contactPerson"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Contact Person Name</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="e.g. John Doe" {...field} type="text" />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="phoneNumber"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Phone Number</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        placeholder="e.g. +91 98765 43210"
                                                        {...field}
                                                        type="tel"
                                                        inputMode="tel"
                                                    />
                                                </FormControl>
                                                <FormDescription className="text-xs text-muted-foreground">
                                                    {/* Include country code. (Validate with pattern or phone library.) */}
                                                </FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <FormField
                                    control={form.control}
                                    name="projectManagers"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Project Managers</FormLabel>
                                            <FormDescription className="text-xs text-muted-foreground mb-2">
                                                {isManager
                                                    ? "As a workspace manager, you will be automatically assigned as the project manager."
                                                    : "Select project managers who will have full project access. (Managers only)"
                                                }
                                            </FormDescription>
                                            <div className="space-y-2">
                                                {isManager ? (
                                                    // For MANAGER: Show non-editable field with their name
                                                    <Input
                                                        value={(() => {
                                                            const currentMember = members?.find((m) => m.userId === currentUserId);
                                                            return currentMember?.user?.surname || "You";
                                                        })()}
                                                        disabled
                                                        className="bg-muted cursor-not-allowed"
                                                    />
                                                ) : (
                                                    // For OWNER/ADMIN: Show dropdown to select one or more project managers
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <Button variant="outline" className="w-full justify-between font-normal h-auto min-h-[40px] py-2">
                                                                <div className="flex flex-wrap gap-1">
                                                                    {field.value && field.value.length > 0 ? (
                                                                        field.value.map((userId) => {
                                                                            const m = members?.find((m) => m.userId === userId);
                                                                            return (
                                                                                <Badge key={userId} variant="secondary" className="px-1 font-normal">
                                                                                    {m?.user?.surname}
                                                                                </Badge>
                                                                            );
                                                                        })
                                                                    ) : (
                                                                        <span className="text-muted-foreground">Select project managers</span>
                                                                    )}
                                                                </div>
                                                            </Button>
                                                        </PopoverTrigger>

                                                        <PopoverContent className="p-0 w-64" align="start">
                                                            <Command>
                                                                <CommandInput placeholder="Search managers…" />
                                                                <CommandEmpty>No workspace managers found.</CommandEmpty>

                                                                <CommandGroup className="max-h-64 overflow-y-auto">
                                                                    {members?.filter(m => m.workspaceRole === "MANAGER").map((member) => {
                                                                        const userName = `${member.user?.surname}`;
                                                                        const isSelected = field.value?.includes(member.userId);

                                                                        return (
                                                                            <CommandItem
                                                                                key={member.userId}
                                                                                onSelect={() => {
                                                                                    const current = field.value || [];
                                                                                    if (isSelected) {
                                                                                        field.onChange(current.filter(id => id !== member.userId));
                                                                                    } else {
                                                                                        field.onChange([...current, member.userId]);
                                                                                    }
                                                                                }}
                                                                            >
                                                                                <div className={cn(
                                                                                    "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                                                    isSelected ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible"
                                                                                )}>
                                                                                    <Check className="h-4 w-4" />
                                                                                </div>
                                                                                {userName}
                                                                            </CommandItem>
                                                                        );
                                                                    })}
                                                                </CommandGroup>
                                                            </Command>
                                                        </PopoverContent>
                                                    </Popover>
                                                )}
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="flex justify-end items-center gap-4 pt-2 mb-2">
                                    <Button type="submit" disabled={pending}>
                                        {pending ? (
                                            <>
                                                Creating...
                                                <Loader2 className="ml-1 h-4 w-4 animate-spin" />
                                            </>
                                        ) : (
                                            <>
                                                Create Project
                                                <PlusIcon className="ml-1" size={16} />
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};
