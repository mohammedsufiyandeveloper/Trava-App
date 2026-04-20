"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition, useEffect } from "react";
import { Resolver, useForm, useWatch } from "react-hook-form";
import { Check, Loader2, Save, SparkleIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { editProjectSchema, EditProjectSchemaType } from "@/lib/zodSchemas";
import { tryCatch } from "@/hooks/try-catch";
import { toast } from "sonner";
import { FullProjectData } from "@/data/project/get-full-project-data";
import slugify from "slugify";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { editProject } from "@/actions/project/update-project";
import { WorkspaceMembersResult } from "@/data/workspace";

interface EditProjectFormProps {
    project: FullProjectData;
    members: WorkspaceMembersResult["workspaceMembers"];
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const EditProjectForm = ({
    project,
    members,
    open,
    onOpenChange,
}: EditProjectFormProps) => {
    const [pending, startTransition] = useTransition();
    const router = useRouter();

    const form = useForm<EditProjectSchemaType>({
        resolver: zodResolver(editProjectSchema) as unknown as Resolver<EditProjectSchemaType>,
        defaultValues: {
            projectId: project.id,
            name: project.name || "",
            description: project.description || "",
            slug: project.slug || "",
            companyName: project.companyName || "",
            registeredCompanyName: project.registeredCompanyName || "",
            directorName: project.directorName || "",
            address: project.address || "",
            gstNumber: project.gstNumber || "",
            contactPerson: project.contactPerson || "",
            phoneNumber: project.phoneNumber || "",
            projectManagers: project.projectMembers?.filter(m => m.projectRole === "PROJECT_MANAGER").map(m => m.userId) || [],
            memberAccess: project.memberAccess || [],
        },
    });

    const watchedName = useWatch({
        control: form.control,
        name: "name",
    });

    const watchedSlug = useWatch({
        control: form.control,
        name: "slug",
    });


    useEffect(() => {
        if (watchedName) {
            const generatedSlug = slugify(watchedName, { lower: true, strict: true });
            form.setValue("slug", generatedSlug, { shouldDirty: true, shouldValidate: true });
        }
    }, [watchedName, form]);

    function onSubmit(data: EditProjectSchemaType) {
        if (pending) return;
        startTransition(async () => {
            const { data: result, error } = await tryCatch(editProject(data));

            if (error) {
                toast.error(error.message);
                console.error(error);
                return;
            }

            if (result.status === "success") {
                toast.success(result.message);
                onOpenChange(false);
                router.refresh();
            } else {
                toast.error(result.message);
            }
        });
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[98vh] w-[min(900px,95vw)] overflow-hidden">
                <DialogHeader>
                    <DialogTitle>Edit Project</DialogTitle>
                </DialogHeader>

                <div className="mt-4 overflow-y-auto px-2 py-1 max-h-[70vh] thin-scrollbar">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                            {/* Project Name */}
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Project Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Enter project name" {...field} />
                                        </FormControl>
                                        <input type="hidden" {...form.register("slug")} />
                                        {watchedSlug && (
                                            <p className="text-[10px] text-muted-foreground mt-1 px-1">
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

                            {/* Company fields - two-column grid */}
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
                                                <Input
                                                    placeholder="Registered company name"
                                                    {...field}
                                                />
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

                            {/* GST Number */}
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
                                            {/* GST is usually 15 characters — alphanumeric. */}
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Contact details - two-column grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="contactPerson"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Contact Person Name</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="e.g. John Doe"
                                                    {...field}
                                                    type="text"
                                                />
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
                                                {/* Include country code. */}
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            {/* Project Managers Selection */}
                            <FormField
                                control={form.control}
                                name="projectManagers"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Project Managers</FormLabel>
                                        <FormDescription className="text-xs text-muted-foreground mb-2">
                                            Select project managers who will have full project access. (Managers only)
                                        </FormDescription>
                                        <div className="space-y-2">
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        className="w-full justify-between font-normal h-auto min-h-[40px] py-2"
                                                    >
                                                        <div className="flex flex-wrap gap-1">
                                                            {field.value && field.value.length > 0 ? (
                                                                field.value.map((userId) => {
                                                                    const m = members?.find(
                                                                        (m) => m.userId === userId
                                                                    );
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
                                                            {members
                                                                ?.filter((m) => m.workspaceRole === "MANAGER")
                                                                .map((member) => {
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
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Submit Button */}
                            <div className="flex justify-end items-center gap-4 pt-2 mb-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => onOpenChange(false)}
                                    disabled={pending}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={pending}>
                                    {pending ? (
                                        <>
                                            Saving...
                                            <Loader2 className="ml-1 h-4 w-4 animate-spin" />
                                        </>
                                    ) : (
                                        <>
                                            Save Changes
                                            <Save className="ml-1" size={16} />
                                        </>
                                    )}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </div>
            </DialogContent>
        </Dialog>
    );
};
