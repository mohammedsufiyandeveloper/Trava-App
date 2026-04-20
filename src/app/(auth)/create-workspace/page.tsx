"use client"

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { workSpaceSchema, WorkSpaceSchemaType } from '@/lib/zodSchemas'
import { Loader2, PlusIcon } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useTransition, useRef } from 'react'
import { toast } from 'sonner'
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Resolver, useWatch } from 'react-hook-form';
import { useConfetti } from '@/hooks/use-confetti'
import { tryCatch } from '@/hooks/try-catch'
import { Textarea } from '@/components/ui/textarea'
import slugify from "slugify";
import { createWorkSpace } from '@/actions/workspace/create-workspace'

import { AppLoader } from '@/components/shared/app-loader'

function CreateWorkspaceContent() {

    const [Pending, startTransition] = useTransition();
    const router = useRouter();
    const params = useSearchParams();
    const noWorkspace = params.get("noWorkspace");
    const { triggerConfetti } = useConfetti();
    const hasToasted = useRef(false);

    const form = useForm<WorkSpaceSchemaType>({
        resolver: zodResolver(workSpaceSchema) as unknown as Resolver<WorkSpaceSchemaType>,
        defaultValues: {
            name: " ",
            description: '',
            slug: '',
        },
    })

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
    function onSubmit(values: WorkSpaceSchemaType) {

        startTransition(async () => {
            const { data: result, error } = await tryCatch(createWorkSpace(values));
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
                router.push("/w");
            } else {
                toast.error(result.message)
            }
        });
    }

    useEffect(() => {
        if (noWorkspace && !hasToasted.current) {
            toast.error("You don't have any workspace. Please create one to continue.");
            hasToasted.current = true;
        }
    }, [noWorkspace]);

    return (
        <div className='relative flex  min-h-svh flex-col items-center justify-center'>
            <Card className='max-w-sm'>
                <CardHeader>
                    <CardTitle>
                        Create Work Space
                    </CardTitle>
                    <CardDescription>
                        Create your work space to manage your work
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form
                            className="space-y-6"
                            onSubmit={form.handleSubmit(onSubmit)}
                        >
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Title</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Title"{...field} />
                                        </FormControl>
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

                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Description</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="Small Description"
                                                className="min-h-[20px]"{...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button type="submit" disabled={Pending}>
                                {
                                    Pending ? (
                                        <>
                                            Creating...
                                            <Loader2 className="ml-1 h-4 w-4 animate-spin" />
                                        </>
                                    ) : (
                                        <>
                                            Create WorkSpace
                                            <PlusIcon className="ml-1" size={16} />
                                        </>
                                    )
                                }
                            </Button>
                            <button
                                type="button"
                                onClick={() => router.push("/")}
                                className="w-full text-center text-sm text-primary/70 hover:text-primary transition cursor-pointer"
                            >
                                Continue with the existing workspace.
                            </button>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    )
}

export default function CreateWorkspace() {
    return (
        <Suspense fallback={<AppLoader />}>
            <CreateWorkspaceContent />
        </Suspense>
    );
}

