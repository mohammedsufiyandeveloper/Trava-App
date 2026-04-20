"use client";

import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { Loader2, Plus } from "lucide-react";
import { z } from "zod";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { inviteUserToWorkspace } from "../actions";
import { inviteUserSchema, InviteUserSchemaType, workspaceMemberRole } from "@/lib/zodSchemas";
import { tryCatch } from "@/hooks/try-catch";
import { useConfetti } from "@/hooks/use-confetti";

interface InviteUserFormProps {
    workspaceId: string;
    isAdmin: boolean;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    hideTrigger?: boolean;
}

export const InviteUserForm = ({ workspaceId, isAdmin, open: controlledOpen, onOpenChange: controlledOnOpenChange, hideTrigger }: InviteUserFormProps) => {
    const router = useRouter();
    const [internalOpen, setInternalOpen] = useState(false);
    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : internalOpen;
    const setOpen = (newOpen: boolean) => {
        if (isControlled) {
            controlledOnOpenChange?.(newOpen);
        } else {
            setInternalOpen(newOpen);
        }
    };
    // const [isSubmitting, setIsSubmitting] = useState(false);
    const [pending, startTransition] = useTransition();
    const { triggerConfetti } = useConfetti();

    const form = useForm<InviteUserSchemaType>({
        resolver: zodResolver(inviteUserSchema),
        defaultValues: {
            name: "",
            email: "",
            password: "",
            niceName: "",
            phoneNumber: "",
            role: "MEMBER",
            workspaceId,
        },
    });
    // async function onSubmit(values: InviteUserSchemaType) {
    //     setIsSubmitting(true);
    //     try {
    //         await inviteUserToWorkspace(values);
    //         toast.success("User invited successfully!");
    //         form.reset();
    //         setOpen(false);
    //     } catch (error) {
    //         toast.error("Failed to invite user. Please try again.");
    //         console.error("Submission error:", error);
    //     } finally {
    //         setIsSubmitting(false);
    //     }
    // }

    function onSubmit(data: InviteUserSchemaType) {
        startTransition(async () => {
            const { data: result, error } = await tryCatch(inviteUserToWorkspace(data));
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
                setOpen(false);
                router.refresh();
            } else {
                toast.error(result.message)
            }
        });
    }


    function onInvalid(errors: any) {
        console.error("Validation errors:", errors);
        toast.error("Please check all required fields");
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {!hideTrigger && isAdmin && (
                <DialogTrigger asChild>
                    <Button>
                        Invite New Member
                        <Plus className="ml-2" size={16} />
                    </Button>
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>Invite New User</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(onSubmit, onInvalid)}
                        className="space-y-4"
                    >
                        {/* Hidden field for workspaceId */}
                        <input
                            type="hidden"
                            {...form.register("workspaceId")}
                            value={workspaceId}
                        />

                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Full Name</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="John Doe"
                                            {...field}
                                            disabled={pending}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="niceName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Nick Name</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="John"
                                                {...field}
                                                disabled={pending}
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
                                            {/* Include country code. (Validate with pattern or phone library.) */}
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Email Address</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="email"
                                            placeholder="john@example.com"
                                            {...field}
                                            disabled={pending}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Password</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="password"
                                            placeholder="••••••••"
                                            {...field}
                                            disabled={pending}
                                        />
                                    </FormControl>
                                    <FormDescription className="text-xs">
                                        Min. 8 chars with uppercase, lowercase & number
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="role"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Category</FormLabel>
                                    <Select
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                    >
                                        <FormControl>
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Select Category" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {workspaceMemberRole.map((role) => (
                                                <SelectItem key={role} value={role}>
                                                    {role}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <Button type="submit" disabled={pending} className="w-full">
                            {pending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Inviting...
                                </>
                            ) : (
                                <>
                                    <Plus className="mr-2" size={16} />
                                    Invite User
                                </>
                            )}
                        </Button>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};
