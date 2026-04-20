"use client";

import { useState, useTransition, useCallback } from "react";
import { Loader2, Download, FileSpreadsheet, Info, Upload, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { tryCatch } from "@/hooks/try-catch";
import { useConfetti } from "@/hooks/use-confetti";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useTaskContext } from "@/app/w/[workspaceId]/_components/shared/task-context";
import { ApiResponse } from "@/lib/types";
import { bulkUploadTasksAndSubtasks } from "@/actions/task/bulk-create-taskAndSubTask";
import { useDropzone, FileRejection } from "react-dropzone";
import { cn } from "@/lib/utils";


interface BulkUploadFormProps {
    projectId: string;
}

interface ParsedTask {
    taskName: string;
    subtaskName?: string;
    description?: string;
    assigneeEmail?: string;
    reviewerEmail?: string;
    startDate?: string;
    days?: number;
    status?: string;
    tag?: string;
}

export const BulkUploadForm = ({ projectId }: BulkUploadFormProps) => {
    const [pending, startTransition] = useTransition();
    const { triggerConfetti } = useConfetti();
    const [open, setOpen] = useState(false);
    const router = useRouter();
    const { setIsAddingTask } = useTaskContext();
    const [parsedData, setParsedData] = useState<ParsedTask[]>([]);
    const [fileName, setFileName] = useState<string>("");

    const downloadTemplate = () => {
        const csvContent = `Task Name,Subtask Name,Description,Assignee Email,Reviewer Email,Start Date,Days,Status,Tag
Design Homepage,,,,,,,,
Design Homepage,Create wireframe,Design wireframe mockup for homepage,john@example.com,mike@example.com,2024-01-15,3,COMPLETED,DESIGN
Design Homepage,Design components,Create reusable UI components,jane@example.com,admin@example.com,2024-01-18,4,IN_PROGRESS,DESIGN
Design Homepage,Review design,Final design review and approval,mike@example.com,,2024-01-22,2,TO_DO,DESIGN
Procurement,,,,,,,,
Procurement,Get quotes,Collect vendor quotes for materials,vendor@example.com,admin@example.com,2024-01-20,2,TO_DO,PROCUREMENT
Procurement,Compare prices,Analyze and compare vendor pricing,admin@example.com,,2024-01-22,1,TO_DO,PROCUREMENT
Project Kickoff,,,,,,,,`;

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'bulk_upload_template.csv';
        link.click();
        toast.success("Template downloaded successfully");
    };

    const downloadInstructions = () => {
        const instructionsContent = `BULK UPLOAD INSTRUCTIONS
            ========================

            HOW TO USE THIS TEMPLATE:
            -------------------------
            1. Download the template CSV file (bulk_upload_template.csv)
            2. Fill in your tasks and subtasks following the format below
            3. Upload the completed CSV file

            COLUMN DESCRIPTIONS:
            -------------------

            1. Task Name (REQUIRED)
            - Required for all rows
            - Group subtasks under the same task name
            - Example: "Design Homepage", "Procurement"

            2. Subtask Name (CONDITIONAL)
            - Leave EMPTY for parent task rows
            - Fill in for subtask rows
            - Example: "Create wireframe", "Get quotes"

            3. Description (OPTIONAL)
            - Optional description for subtasks
            - Can be left empty
            - Example: "Design wireframe mockup for homepage"

            4. Assignee Email (OPTIONAL)
            - Email address of project member
            - Member must be added to the project first
            - Example: "john@example.com"

            5. Reviewer Email (OPTIONAL)
            - Email address of reviewer (must be Owner/Admin/PM/Lead)
            - If left empty, defaults to task creator
            - Example: "admin@example.com"

            6. Start Date (OPTIONAL)
            - Format: YYYY-MM-DD
            - Example: "2024-01-15"

            7. Days (OPTIONAL)
            - Number of days to complete the subtask
            - Must be an integer
            - Example: 3, 5, 10

            8. Status (OPTIONAL)
            - Valid values:
                * TO_DO (default)
                * IN_PROGRESS
                * REVIEW
                * COMPLETED
                * CANCELLED
                * HOLD

            9. Tag (OPTIONAL)
            - Valid values:
                * DESIGN
                * PROCUREMENT
                * CONTRACTOR

            IMPORTANT RULES:
            ---------------
            ✓ Each parent task must have at least one row with only Task Name filled
            ✓ Subtasks must have both Task Name AND Subtask Name filled
            ✓ All subtasks with the same Task Name will be grouped under that parent task
            ✓ Assignee emails must match existing project members
            ✓ Dates must be in YYYY-MM-DD format
            ✓ Status and Tag values are case-sensitive

            EXAMPLE STRUCTURE:
            -----------------

            Task Name          | Subtask Name      | Description                    | Assignee Email      | Reviewer Email      | Start Date | Days | Status      | Tag
            -------------------|-------------------|--------------------------------|---------------------|---------------------|------------|------|-------------|-------------
            Design Homepage    |                   |                                |                     |                     |            |      |             |
            Design Homepage    | Create wireframe  | Design wireframe mockup        | john@example.com    | admin@example.com   | 2024-01-15 | 3    | COMPLETED   | DESIGN
            Design Homepage    | Design components | Create reusable UI components  | jane@example.com    |                     | 2024-01-18 | 4    | IN_PROGRESS | DESIGN
            Procurement        |                   |                                |                     |                     |            |      |             |
            Procurement        | Get quotes        | Collect vendor quotes          | vendor@example.com  | admin@example.com   | 2024-01-20 | 2    | TO_DO       | PROCUREMENT

            TIPS:
            -----
            • Delete the example rows from the template before adding your data
            • Use a spreadsheet program (Excel, Google Sheets) to edit the CSV
            • Save as CSV format before uploading
            • Test with a small batch first to ensure correct formatting

            For support, contact your workspace administrator.
            `;

        const blob = new Blob([instructionsContent], { type: 'text/plain;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'bulk_upload_instructions.txt';
        link.click();
        toast.success("Instructions downloaded successfully");
    };

    // Helper function to sanitize strings and remove null bytes
    const sanitizeString = (str: string): string => {
        if (!str) return str;
        // Remove null bytes (0x00) and other control characters except newlines and tabs
        return str.replace(/\x00/g, '').replace(/[\x01-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '').trim();
    };

    const parseCSV = (text: string): ParsedTask[] => {
        // First, sanitize the entire text to remove null bytes
        const sanitizedText = sanitizeString(text);

        const lines = sanitizedText.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
            throw new Error("CSV file is empty or invalid");
        }

        const dataLines = lines.slice(1);
        const tasks: ParsedTask[] = [];

        for (const line of dataLines) {
            const values = line.split(',').map(v => sanitizeString(v));

            // Pad the values array to ensure we have at least 9 elements
            while (values.length < 9) {
                values.push('');
            }

            const [taskName, subtaskName, description, assigneeEmail, reviewerEmail, startDate, days, status, tag] = values;

            // Skip rows without a task name
            if (!taskName) continue;

            tasks.push({
                taskName,
                subtaskName: subtaskName || undefined,
                description: description || undefined,
                assigneeEmail: assigneeEmail || undefined,
                reviewerEmail: reviewerEmail || undefined,
                startDate: startDate || undefined,
                days: days ? parseInt(days) : undefined,
                status: status || undefined,
                tag: tag || undefined,
            });
        }

        return tasks;
    };

    const clearFile = () => {
        setParsedData([]);
        setFileName("");
    };

    const processFile = async (file: File) => {
        setFileName(file.name);

        try {
            const text = await file.text();

            // Check if file contains too many non-printable/binary characters
            const nonPrintableCount = (text.match(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\xFF]/g) || []).length;
            const totalChars = text.length;
            const nonPrintableRatio = totalChars > 0 ? nonPrintableCount / totalChars : 0;

            // If more than 20% of characters are non-printable, file is likely corrupted/binary
            if (nonPrintableRatio > 0.2) {
                toast.error(
                    "❌ File Upload Failed: The file appears to be corrupted or contains binary data.\n\n" +
                    "Cannot validate assignee emails or other data because the file cannot be read properly.\n\n" +
                    "Please create a new CSV file:\n" +
                    "• Use the template file (test-bulk-upload.csv)\n" +
                    "• Or create a new file in Notepad/Google Sheets\n" +
                    "• Save as UTF-8 CSV format",
                    { duration: 8000 }
                );
                setParsedData([]);
                setFileName("");
                return;
            }

            // Check if file looks like a CSV (has commas and reasonable structure)
            const hasCommas = text.includes(',');
            const hasNewlines = text.includes('\n') || text.includes('\r');

            if (!hasCommas || !hasNewlines) {
                toast.error("The file doesn't appear to be a valid CSV. Please ensure it's a comma-separated values file.");
                setParsedData([]);
                setFileName("");
                return;
            }

            const parsed = parseCSV(text);

            console.log('Parsed CSV:', parsed.length, 'rows');

            if (parsed.length === 0) {
                toast.error("No valid data found in file");
                return;
            }

            setParsedData(parsed);
            toast.success(`Parsed ${parsed.length} rows successfully`);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to parse file");
            setParsedData([]);
            setFileName("");
        }
    };

    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            processFile(acceptedFiles[0]);
        }
    }, []);

    const onDropRejected = useCallback((fileRejections: FileRejection[]) => {
        if (fileRejections.length) {
            const tooManyFiles = fileRejections.find(
                (rejection) => rejection.errors[0].code === 'too-many-files'
            );

            const fileSizeToBig = fileRejections.find(
                (rejection) => rejection.errors[0].code === 'file-too-large'
            );

            const wrongFileType = fileRejections.find(
                (rejection) => rejection.errors[0].code === 'file-invalid-type'
            );

            if (tooManyFiles) {
                toast.error('Too many files selected, max is 1');
            }

            if (fileSizeToBig) {
                toast.error('File size exceeds the limit (10MB)');
            }

            if (wrongFileType) {
                toast.error('Invalid file type. Please upload a CSV file');
            }
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'text/csv': ['.csv'],
            'application/vnd.ms-excel': ['.csv'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.ms-excel.sheet.macroEnabled.12': ['.xlsm']
        },
        maxFiles: 1,
        multiple: false,
        maxSize: 10 * 1024 * 1024, // 10MB
        onDropRejected,
        disabled: pending || parsedData.length > 0,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (parsedData.length === 0) {
            toast.error("Please upload a file first");
            return;
        }

        startTransition(async () => {
            setIsAddingTask(true);
            const { data: result, error } = await tryCatch<ApiResponse>(
                bulkUploadTasksAndSubtasks({
                    projectId,
                    tasks: parsedData,
                })
            );

            if (error) {
                // Log full error details to console for debugging
                console.error('❌ Bulk Upload Error:', error);
                console.error('Error details:', {
                    message: error.message,
                    stack: error.stack,
                    name: error.name,
                });

                // Show error message in toast with longer duration
                toast.error(error.message || 'An unexpected error occurred', {
                    duration: 10000, // 10 seconds
                });
                setIsAddingTask(false);
                return;
            }

            if (result && result.status === "success") {
                toast.success(result.message || "Tasks uploaded successfully");
                triggerConfetti();

                setParsedData([]);
                setFileName("");
                setOpen(false);

                router.refresh();
            } else {
                // Log error result to console
                console.error('❌ Bulk Upload Failed:', result);

                // Show detailed error message
                const errorMessage = result?.message || 'Upload failed. Please try again.';
                toast.error(errorMessage, {
                    duration: 10000, // 10 seconds for error messages
                });
                setIsAddingTask(false);
            }
        });
    };

    const taskCount = parsedData.filter(t => !t.subtaskName).length;
    const subtaskCount = parsedData.filter(t => t.subtaskName).length;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    Bulk Upload
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Bulk Upload Tasks & Subtasks</DialogTitle>
                    <DialogDescription>
                        Upload an Excel/CSV file with tasks and subtasks
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-900">
                        <div className="flex items-start gap-3">
                            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                            <div className="space-y-2 flex-1">
                                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                                    Download the required files to get started:
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={downloadTemplate}
                                        className="gap-2 bg-white dark:bg-gray-800"
                                    >
                                        <FileSpreadsheet className="h-4 w-4" />
                                        Template CSV
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={downloadInstructions}
                                        className="gap-2 bg-white dark:bg-gray-800"
                                    >
                                        <Download className="h-4 w-4" />
                                        Instructions
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* File Upload */}
                    <div className="space-y-3">
                        <Label>Upload CSV File</Label>
                        <div
                            {...getRootProps()}
                            className={cn(
                                "relative border-2 border-dashed rounded-lg p-8 transition-all duration-200 cursor-pointer",
                                isDragActive
                                    ? "border-primary bg-primary/10 border-solid"
                                    : parsedData.length > 0
                                        ? "border-green-500 bg-green-50 dark:bg-green-950/20"
                                        : "border-gray-300 dark:border-gray-700 hover:border-primary hover:bg-accent/50",
                                (pending || parsedData.length > 0) && "cursor-not-allowed opacity-60"
                            )}
                        >
                            <input {...getInputProps()} />
                            <div className="flex flex-col items-center justify-center gap-3">
                                {parsedData.length > 0 ? (
                                    <>
                                        <div className="p-3 rounded-full bg-green-500/10">
                                            <FileSpreadsheet className="h-6 w-6 text-green-600 dark:text-green-400" />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-sm font-medium text-foreground flex items-center gap-2 justify-center">
                                                {fileName}
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 w-6 p-0"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        clearFile();
                                                    }}
                                                    disabled={pending}
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                File loaded successfully
                                            </p>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="p-3 rounded-full bg-primary/10">
                                            <Upload className="h-6 w-6 text-primary" />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-sm font-medium text-foreground">
                                                {isDragActive ? "Drop the file here" : "Click to upload or drag and drop"}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                CSV, XLSX, or XLS files only (max 10MB)
                                            </p>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Preview */}
                    {parsedData.length > 0 && (
                        <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg border border-green-200 dark:border-green-900">
                            <div className="space-y-1">
                                <p className="font-semibold text-sm">Preview:</p>
                                <p className="text-sm">
                                    • {taskCount} task{taskCount !== 1 ? 's' : ''}
                                </p>
                                <p className="text-sm">
                                    • {subtaskCount} subtask{subtaskCount !== 1 ? 's' : ''}
                                </p>
                                <p className="text-sm text-muted-foreground mt-2">
                                    Total: {parsedData.length} rows
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setOpen(false)}
                            disabled={pending}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={pending || parsedData.length === 0}>
                            {pending ? (
                                <>
                                    Uploading...
                                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                                </>
                            ) : (
                                <>
                                    Upload {parsedData.length} Items
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};
