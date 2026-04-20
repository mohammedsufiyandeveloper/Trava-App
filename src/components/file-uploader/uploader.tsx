"use client";

import { cn } from "@/lib/utils";
import { use, useCallback, useEffect, useState } from "react";
import { FileRejection, useDropzone } from "react-dropzone";
import { CardContent } from "../ui/card";
import { RenderEmptyState, RenderErrorState, RenderUplodedState, RenderUplodingState } from "./renderState";
import { toast } from "sonner";
import { useConstructUrl } from "@/hooks/use-constract-url";
import { file } from "zod";

interface UploaderState {
    id: string | null;
    file: File | null;
    uploading: boolean;
    progress: number;
    key?: string;
    isDeleting: boolean;
    error: boolean;
    objectURL?: string;
    fileType: "image" | "video";
}

interface iAppProps {
    value?: string;
    onChange?: (value: string) => void
    fileTypeAcepted: "image" | "video";
}

export function Uploader({ value, onChange, fileTypeAcepted }: iAppProps) {
    const fileUrl = useConstructUrl(value || "");

    const [fileState, setFileState] = useState<UploaderState>({
        error: false,
        file: null,
        id: null,
        uploading: false,
        progress: 0,
        isDeleting: false,
        fileType: fileTypeAcepted,
        key: value,
        objectURL: value ? fileUrl : undefined,
    });


    const uploadFile = useCallback(
        async (file: File) => {
            setFileState((prev) => ({
                ...prev,
                uploading: true,
                progress: 0,
            }));

            try {
                //1 get presign URL
                const presignedResponce = await fetch('/api/s3/upload', {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        fileName: file.name,
                        contentType: file.type,
                        size: file.size,
                        isImage: fileTypeAcepted === "image" ? true : false,
                    }),
                });

                if (!presignedResponce.ok) {
                    toast.error('Failed to get presigined URL');
                    setFileState((prev) => ({
                        ...prev,
                        uploading: false,
                        progress: 0,
                        error: true,
                    }));

                    return;
                }

                const { preSiginedURL, key } = await presignedResponce.json();

                await new Promise<void>((resolve, reject) => {
                    const xhr = new XMLHttpRequest()

                    xhr.upload.onprogress = (event) => {
                        if (event.lengthComputable) {
                            const percentageCompleted = (event.loaded / event.total) * 100
                            setFileState((prev) => ({
                                ...prev,
                                progress: Math.round(percentageCompleted)
                            }));
                        }
                    }
                    xhr.onload = () => {
                        if (xhr.status == 200 || xhr.status === 204) {
                            setFileState((prev) => ({
                                ...prev,
                                progress: 100,
                                uploading: false,
                                key: key
                            }));

                            onChange?.(key);

                            toast.success('File uploded succsfully')
                            resolve()
                        } else {
                            reject(new Error("upload failed..."))
                        }
                    };

                    xhr.onerror = () => {
                        reject(new Error("upload failed"));
                    };

                    xhr.open("PUT", preSiginedURL);
                    xhr.setRequestHeader("Content-Type", file.type);
                    xhr.send(file);
                });

            } catch {
                toast.error("Somting went wrong");

                setFileState((prev) => ({
                    ...prev,
                    progress: 0,
                    error: true,
                    uploading: false,
                }));
            }
        }, [fileTypeAcepted, onChange]
    );

    const onDrop = useCallback(
        (acceptedFiles: File[]) => {
            if (acceptedFiles.length > 0) {
                const file = acceptedFiles[0]
                if (fileState.objectURL && !fileState.objectURL.startsWith("https://")) {
                    URL.revokeObjectURL(fileState.objectURL);
                }

                setFileState({
                    file: file,
                    uploading: false,
                    progress: 0,
                    objectURL: URL.createObjectURL(file),
                    error: false,
                    id: crypto.randomUUID(),
                    isDeleting: false,
                    fileType: fileTypeAcepted,
                });
                uploadFile(file);
            }
        }, [fileState.objectURL, fileTypeAcepted, uploadFile]
    );

    async function hadleRemoveFiles() {
        if (fileState.isDeleting || !fileState.objectURL) return;
        try {
            setFileState((prev) => ({
                ...prev,
                isDeleting: true,
            }));

            const res = await fetch('/api/s3/delete', {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    key: fileState.key
                }),
            });

            if (!res.ok) {
                toast.error('Failed to delete file')
                setFileState((prev) => ({
                    ...prev,
                    isDeleting: true,
                    error: true,
                }));
                return;
            }

            if (fileState.objectURL && !fileState.objectURL.startsWith("https")) {
                URL.revokeObjectURL(fileState.objectURL);
            }

            onChange?.('');

            setFileState({
                file: null,
                uploading: false,
                progress: 0,
                objectURL: undefined,
                error: false,
                id: null,
                isDeleting: false,
                fileType: fileTypeAcepted,
            });

            toast.success('File deleted succsfully')
        } catch {
            toast.error('remove file failed try again')

            setFileState((prev) => ({
                ...prev,
                isDeleting: false,
                error: true,
            }));
        }
    };

    function rejectedFiles(fileRejection: FileRejection[]) {
        if (fileRejection.length) {
            const tooManyFiles = fileRejection.find(
                (rejection) => rejection.errors[0].code === 'too-many-files'
            );

            const fileSizeToBig = fileRejection.find(
                (rejection) => rejection.errors[0].code === 'file-too-large'
            );

            if (tooManyFiles) {
                toast.error('Too many files selected, max is 1')
            }

            if (fileSizeToBig) {
                toast.error('File size is exceded the limit')
            }
        }
    }

    function renderContent() {
        if (fileState.uploading) {
            return (
                <RenderUplodingState progress={fileState.progress} file={fileState.file as File} />
            )
        }

        if (fileState.error) {
            return <RenderErrorState />
        }

        if (fileState.objectURL) {
            return (
                <RenderUplodedState
                    previewUrl={fileState.objectURL}
                    isDeleting={fileState.isDeleting}
                    hadleRemoveFiles={hadleRemoveFiles}
                    fileType={fileState.fileType}
                />
            )
        }
        return <RenderEmptyState isDragActive={isDragActive} />
    }

    useEffect(() => {
        return () => {
            if (fileState.objectURL && !fileState.objectURL.startsWith("https://")) {
                URL.revokeObjectURL(fileState.objectURL);
            }
        };
    }, [fileState.objectURL])

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: fileTypeAcepted === 'video' ? { 'video/*': [] } : { 'image/*': [] },
        maxFiles: 1,
        multiple: false,
        maxSize:
            fileTypeAcepted === 'image' ? 5 * 1024 * 1024 : 5000 * 1024 * 1024,
        onDropRejected: rejectedFiles,
        disabled: fileState.uploading || !!fileState.objectURL,
    },

    );

    return (
        <div {...getRootProps()} className={cn("relative border-2 border-dashed border-gray-400 transition-colors duration-200 ease-in-out w-full h-64",
            isDragActive
                ? "border-primary bg-primary/10 border-solid"
                : "border-border hover:border-primary")}
        >
            <CardContent className="flex items-center justify-center h-full w-full p-4">
                <input {...getInputProps()} />
                {renderContent()}
            </CardContent>
        </div>
    );
}
