import { cn } from "@/lib/utils";
import { CloudUploadIcon, ImageIcon, Loader, Loader2, XIcon } from "lucide-react";
import { Button } from "../ui/button";
import Image from "next/image";


export function RenderEmptyState({ isDragActive }: { isDragActive: boolean }) {
    return (
        <div className="text-center">
            <div className="flex items-center mx-auto justify-center size-12 rounded-full bg-muted mb-4">
                <CloudUploadIcon className={cn(
                    "size-6 text-muted-foreground",
                    isDragActive && "text-primary"
                )}
                />
            </div>
            <p className="text-base font-semibold text-foreground">
                Drop Your files here or <span className="text-primary font-bold cursor-pointer">click to uploader</span>
            </p>
            <Button type="button" className="mt-4">
                Select File
            </Button>
        </div>
    )
}

export function RenderErrorState() {
    return (
        <div className="text-center">
            <div className="flex items-center mx-auto justify-center size-12 rounded-full bg-muted mb-4">
                <ImageIcon className={cn("size-6 text-destructive")} />
            </div>
            <p className="text-base font-semibold">Uplode Failed</p>
            <p className="text-xs mt-1 text-muted-foreground">Somthing Went wrong</p>
            <Button type="button" className="mt-4">
                Retry File Selection
            </Button>
        </div>
    )
}

export function RenderUplodedState({
    previewUrl,
    isDeleting,
    hadleRemoveFiles,
    fileType,

}: {
    previewUrl: string;
    isDeleting: boolean;
    hadleRemoveFiles: () => void;
    fileType: "image" | "video";
}) {
    return (
        <div className="relative group w-full h-full flex items-center justify-center">

            {fileType === "video" ? (
                <video
                    src={previewUrl}
                    controls
                    className="rounded-md w-full h-full"
                />
            ) : (
                <Image
                    src={previewUrl}
                    alt="preview"
                    fill
                    className="object-contain p-2"
                />
            )}

            <Button
                variant="destructive"
                type="button"
                className={cn("absolute top-2 right-2")}
                onClick={hadleRemoveFiles}
                disabled={isDeleting}
            >
                {isDeleting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <XIcon className="size-4" />
                )}
            </Button>
        </div>

    )
}

export function RenderUplodingState({ progress, file }: { progress: number; file: File }) {
    return (
        <div className="text-center flex justify-center items-center flex-col">

            <p>{progress}%</p>
            <p className="mt-2 text-sm font-medium text-foreground">Uploading...</p>

            <p className="mt-1 text-xs text-muted-foreground truncate max-w-xs">{file.name}</p>
        </div>
    )
}
