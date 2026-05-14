import { z } from 'zod'
import { parseIST } from './utils'

export const SubTaskStatus = ["TO_DO", "IN_PROGRESS", "REVIEW", "HOLD", "COMPLETED", "CANCELLED"] as const

// Status labels - single source of truth
export const STATUS_LABELS: Record<typeof SubTaskStatus[number], string> = {
    TO_DO: "To Do",
    IN_PROGRESS: "In Progress",
    REVIEW: "Review",
    COMPLETED: "Completed",
    HOLD: "On Hold",
    CANCELLED: "Cancelled",
} as const;

// Status options for dropdowns
export const STATUS_OPTIONS = SubTaskStatus.map(value => ({
    value,
    label: STATUS_LABELS[value]
}));

export const workspaceMemberRole = ["OWNER", "ADMIN", "MEMBER", "VIEWER"] as const

export const projectRole = ["LEAD", "MEMBER", "VIEWER"] as const

export const unitCategories = ["Weight", "Length", "Volume", "Area", "Quantity", "Time"] as const;

export const materialIndentItemStatus = ["PENDING", "APPROVED", "REJECTED", "QUANTITY_APPROVED", "VENDOR_PENDING"] as const;

export const inviteUserSchema = z.object({
    name: z
        .string()
        .min(3, { message: "Name must be at least 3 charcters long" })
        .max(100, { message: "Name must be at most 100 character long" }),
    niceName: z
        .string()
        .min(1, { message: "Name must be at least 1 charcters long" })
        .max(100, { message: "Name must be at most 100 character long" }),
    email: z
        .string()
        .min(3, { message: "Email must be at least 3 charcters long" })
        .max(100, { message: "Email must be at most 100 character long" }),
    phoneNumber: z
        .string()
        .min(10, { message: "Phone Number must be at least 10 characters long" })
        .max(15, { message: "Phone Number must be at most 15 characters long" }),
    password: z
        .string()
        .min(8, "Password must be at least 8 characters")
        .regex(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
            "Password must contain at least one uppercase letter, one lowercase letter, and one number"
        ),
    role: z.enum(workspaceMemberRole, { message: "Role is required" }),
    workspaceId: z.string().uuid({ message: "Invalid workspace id" }),
});

export const workSpaceSchema = z.object({
    name: z
        .string()
        .min(3, { message: "Name must be at least 3 charcters long" })
        .max(100, { message: "Name must be at most 100 character long" }),
    slug: z
        .string()
        .min(3, { message: "Slug must be at least 3 charcters long" })
        .max(50, { message: "Slug must be at most 50 character long" }),
    description: z
        .string()
        .min(3, { message: "description must be at least 3 charcters long" }),
});

export const updateWorkspaceInfoSchema = z.object({
    workspaceId: z.string().uuid(),
    name: z.string()
        .min(3, { message: "Name must be at least 3 charcters long" })
        .max(100, { message: "Name must be at most 100 character long" }),
    // Legal
    legalName: z.string()
        .min(1, { message: "Legal Name is required" })
        .max(100, { message: "Legal Name must be at most 100 character long" }),
    gstNumber: z.string()
        .min(1, { message: "GST Number is required" })
        .max(20, { message: "GST Number must be at most 20 character long" }),
    panNumber: z.string()
        .max(20, { message: "Pan Number must be at most 20 character long" }).optional().nullable(),
    companyType: z.string()
        .min(1, { message: "Company Type is required" }),
    industry: z.string()
        .min(1, { message: "Industry is required" }),
    msmeNumber: z.string()
        .min(1, { message: "MSME Number is required" }),
    description: z.string().optional().nullable(),
    // Contact
    email: z.string()
        .email({ message: "Invalid email address" }),
    phone: z.string()
        .min(1, { message: "Phone is required" })
        .max(20, { message: "Phone must be at most 20 character long" }),
    website: z.string()
        .url().optional().nullable().or(z.literal("")),
    // Address
    addressLine1: z.string()
        .min(1, { message: "Address Line 1 is required" })
        .max(100, { message: "Address Line 1 must be at most 100 character long" }),
    addressLine2: z.string()
        .max(100, { message: "Address Line 2 must be at most 100 character long" }).optional().nullable(),
    city: z.string()
        .min(1, { message: "City is required" })
        .max(50, { message: "City must be at most 50 character long" }),
    state: z.string()
        .min(1, { message: "State is required" })
        .max(50, { message: "State must be at most 50 character long" }),
    country: z.string()
        .min(1, { message: "Country is required" })
        .max(50, { message: "Country must be at most 50 character long" }),
    pincode: z.string()
        .min(1, { message: "Pincode is required" })
        .max(20, { message: "Pincode must be at most 20 character long" }),
});

export const projectSchema = z.object({
    name: z
        .string()
        .min(2, { message: "Name must be at least 2 characters long" })
        .max(100, { message: "Name must be at most 100 character long" }),
    description: z
        .string()
        .min(1, { message: "description must be at least 1 characters long" })
        .optional()
        .or(z.literal("")),
    slug: z
        .string()
        .min(3, { message: "Slug must be at least 3 charcters long" })
        .max(50, { message: "Slug must be at most 50 character long" }),
    color: z.string().optional(),
    companyName: z
        .string()
        .min(3, { message: "Company Name must be at least 3 charcters long" })
        .max(100, { message: "Company Name must be at most 100 character long" })
        .optional(),
    registeredCompanyName: z
        .string()
        .min(3, { message: "Registered Company Name must be at least 3 charcters long" })
        .max(100, { message: "Registered Company Name must be at most 100 character long" })
        .optional(),
    directorName: z
        .string()
        .min(3, { message: "Location must be at least 3 charcters long" })
        .max(100, { message: "Location must be at most 100 character long" })
        .optional(),
    address: z
        .string()
        .min(3, { message: "Address must be at least 3 charcters long" })
        .max(150, { message: "Address Name must be at most 150 character long" })
        .optional(),
    gstNumber: z
        .string()
        .max(15, { message: "GST is usually 15 characters — alphanumeric." })
        .max(15, { message: "GST is usually 15 characters — alphanumeric." })
        .optional(),
    contactPerson: z
        .string()
        .min(3, { message: "Contact Person must be at least 3 charcters long" })
        .max(100, { message: "Contact Person must be at most 100 character long" })
        .optional(),
    phoneNumber: z
        .string()
        .min(10, { message: "Phone Number must be at least 10 characters long" })
        .max(15, { message: "Phone Number must be at most 15 characters long" })
        .optional(),
    workspaceId: z
        .string().optional(),
    projectLead: z.string().optional(),
    projectManagers: z.array(z.string()).min(1, { message: "At least one project manager is required" }).optional(),
    memberAccess: z.array(z.string()),
}).refine((data) => {
    // Either projectLead OR projectManagers must be provided
    return data.projectLead || (data.projectManagers && data.projectManagers.length > 0);
}, {
    message: "At least one project manager is required",
    path: ["projectManagers"]
});

export const editProjectSchema = z.object({
    projectId: z.string().min(1, { message: "Project ID is required" }),

    name: z
        .string()
        .min(3, { message: "Name must be at least 3 characters long" })
        .max(100, { message: "Name must be at most 100 characters long" }),
    description: z
        .string()
        .min(3, { message: "Description must be at least 3 characters long" })
        .optional()
        .or(z.literal("")),
    slug: z
        .string()
        .min(3, { message: "Slug must be at least 3 characters long" })
        .max(50, { message: "Slug must be at most 50 characters long" })
        .optional()
        .or(z.literal("")),
    // Client/Company fields
    companyName: z
        .string()
        .min(3, { message: "Company Name must be at least 3 characters long" })
        .max(100, { message: "Company Name must be at most 100 characters long" })
        .optional()
        .or(z.literal("")),
    registeredCompanyName: z
        .string()
        .min(3, { message: "Registered Company Name must be at least 3 characters long" })
        .max(100, { message: "Registered Company Name must be at most 100 characters long" })
        .optional()
        .or(z.literal("")),
    directorName: z
        .string()
        .min(3, { message: "Director Name must be at least 3 characters long" })
        .max(100, { message: "Director Name must be at most 100 characters long" })
        .optional()
        .or(z.literal("")),
    address: z
        .string()
        .min(3, { message: "Address must be at least 3 characters long" })
        .max(150, { message: "Address must be at most 150 characters long" })
        .optional()
        .or(z.literal("")),
    gstNumber: z
        .string()
        .max(15, { message: "GST is usually 15 characters — alphanumeric." })
        .optional()
        .or(z.literal("")),
    contactPerson: z
        .string()
        .min(3, { message: "Contact Person must be at least 3 characters long" })
        .max(100, { message: "Contact Person must be at most 100 characters long" })
        .optional()
        .or(z.literal("")),
    phoneNumber: z
        .string()
        .min(10, { message: "Phone Number must be at least 10 characters long" })
        .max(15, { message: "Phone Number must be at most 15 characters long" })
        .optional()
        .or(z.literal("")),
    color: z.string().optional().or(z.literal("")),
    // Team fields
    projectLead: z.string().optional(),
    projectManagers: z.array(z.string()).optional(),
    memberAccess: z.array(z.string()).optional(),
});

export const taskSchema = z.object({
    name: z
        .string()
        .min(3, { message: "Title must be at least 3 charcters long" })
        .max(100, { message: "Title must be at most 100 character long" }),
    taskSlug: z
        .string()
        .min(3, { message: "Title must be at least 3 charcters long" })
        .max(100, { message: "Title must be at most 100 character long" }),
    projectId: z.string().uuid({ message: "Invalid project id" }),
    status: z.enum(SubTaskStatus).optional(),
    priority: z.string().optional(),
    description: z.string().optional(),
    dueDate: z.string().optional().nullable(),
    startDate: z.string().optional().nullable(),
    tagId: z.string().uuid().optional().nullable(),
    assigneeUserId: z.string().uuid().optional().nullable(),
    reviewerId: z.string().uuid({ message: "Invalid reviewer id" }).optional().nullable(),
});

export const subTaskSchema = z.object({
    name: z
        .string()
        .min(3, { message: "Title must be at least 3 charcters long" })
        .max(100, { message: "Title must be at most 100 character long" }),
    description: z
        .string()
        .min(3, { message: "description must be at least 3 charcters long" })
        .optional(),
    taskSlug: z
        .string()
        .min(3, { message: "Title must be at least 3 charcters long" })
        .max(100, { message: "Title must be at most 100 character long" }),
    status: z
        .enum(SubTaskStatus, { message: "status is Required" }),
    assignee: z
        .string()
        .min(1, { message: "Assignee is required" }),
    reviewerId: z.string().optional(),
    startDate: z
        .string()
        .optional(),
    dueDate: z
        .string()
        .min(1, { message: "Due date is required" }),
    days: z.number().min(1, { message: "Number of days is required" }),
    tag: z
        .string()
        .uuid({ message: "Tag is required" }),
    projectId: z.string().uuid({ message: "Invalid project id" }),
    parentTaskId: z.string().uuid({ message: "Invalid parent task id" }),
}).refine((data) => {
    if (data.startDate && data.dueDate) {
        const start = parseIST(data.startDate);
        const due = parseIST(data.dueDate);
        if (start && due) {
            return due >= start;
        }
    }
    return true;
}, {
    message: "Due date must be after start date",
    path: ["dueDate"],
});

export const unitSchema = z.object({
    name: z
        .string()
        .min(1, { message: "Unit name is required" })
        .max(50, { message: "Unit name must be at most 50 characters long" }),
    abbreviation: z
        .string()
        .min(1, { message: "Abbreviation is required" })
        .max(10, { message: "Abbreviation must be at most 10 characters long" }),
    category: z
        .enum(unitCategories, { message: "Please select a valid category" })
        .optional(),
    isDefault: z.boolean().default(false).optional(),
    isActive: z.boolean().default(true).optional(),
});

export const materialSchema = z.object({
    name: z
        .string()
        .min(3, { message: "Material name must be at least 3 characters long" })
        .max(100, { message: "Material name must be at most 100 characters long" }),
    specifications: z
        .string()
        .max(500, { message: "Specifications must be at most 500 characters long" })
        .optional()
        .nullable(),
    defaultUnitId: z
        .string()
        .uuid({ message: "Please select a valid unit" }),
    workspaceId: z
        .string()
        .uuid({ message: "Invalid workspace id" }),
    isActive: z.boolean().default(true).optional(),
});

export const vendorSchema = z.object({
    name: z
        .string()
        .min(2, { message: "Vendor name must be at least 2 characters long" })
        .max(100, { message: "Vendor name must be at most 100 characters long" }),
    companyName: z
        .string()
        .max(100, { message: "Company name must be at most 100 characters long" })
        .optional()
        .nullable(),
    contactPerson: z
        .string()
        .max(100, { message: "Contact person must be at most 100 characters long" })
        .optional()
        .nullable(),
    phoneNumber: z
        .string()
        .max(20, { message: "Phone number must be at most 20 characters long" })
        .optional()
        .nullable(),
    email: z
        .string()
        .email({ message: "Invalid email address" })
        .optional()
        .nullable()
        .or(z.literal("")),
    address: z
        .string()
        .max(200, { message: "Address must be at most 200 characters long" })
        .optional()
        .nullable(),
    gstNumber: z
        .string()
        .max(20, { message: "GST number must be at most 20 characters long" })
        .optional()
        .nullable(),
    workspaceId: z
        .string()
        .uuid({ message: "Invalid workspace id" }),
    isActive: z.boolean().default(true).optional(),
    materialIds: z.array(z.string()).optional(),
});

export const indentSchema = z.object({
    name: z.string()
        .min(1, { message: "Indent name is required" }),
    indentKey: z.string()
        .min(1, { message: "Indent key is required" }),
    projectId: z.string().optional().nullable(),
    description: z.string().optional(),
    requiredDate: z.date().optional().nullable(),
    procurementTaskId: z.string().optional().nullable(),
});

export const indentStep1Schema = z.object({
    name: z.string()
        .min(3, { message: "Name must be at least 3 characters" })
        .max(150, { message: "Name must be at most 150 characters" }),
    projectId: z.string()
        .min(1, { message: "Project is required" })
        .max(150, { message: "Project must be at most 150 characters" }),
    taskId: z.string().optional(),
    description: z.string().optional(),
    expectedDelivery: z.date({ message: "Expected delivery date is required" }),
    requiresVendor: z.boolean(),
    assignedTo: z.string()
        .min(1, { message: "Assignee is required" })
        .max(150, { message: "Assignee must be at most 150 characters" }),
});

export const materialIndentItemSchema = z.object({
    materialId: z.string().min(1, { message: "Material is required" }),
    quantity: z.number().min(0.01, { message: "Quantity must be greater than 0" }),
    unitId: z.string().optional(),
    vendorId: z.string().optional().nullable(),
    estimatedPrice: z.number().optional().nullable(),
    itemStatus: z.enum(materialIndentItemStatus),
    documentDisplayName: z.string()
        .min(1, { message: "Document display name is required" })
        .max(500, { message: "Document display name must be at most 500 characters" }),
}).refine((data) => {
    if (data.vendorId && (!data.estimatedPrice || data.estimatedPrice <= 0)) {
        return false;
    }
    return true;
}, {
    message: "Price is required when vendor is selected",
    path: ["estimatedPrice"]
});

export const indentStep2Schema = z.object({
    materials: z.array(materialIndentItemSchema)
        .min(1, { message: "At least one material is required" }),
});

export const indentDialogSchema = indentStep1Schema.merge(indentStep2Schema.partial());

export const createIndentRequestSchema = z.object({
    workspaceId: z.string(),
    name: z.string()
        .min(3, { message: "Name must be at least 3 characters long" }),
    projectId: z.string(),
    taskId: z.string().optional(),
    description: z.string().optional(),
    expectedDelivery: z.date(),
    materials: z.array(materialIndentItemSchema).optional(),
    requiresVendor: z.boolean().default(true),
    assignedTo: z.string(),
});

export const deleteIndentSchema = z.object({
    workspaceId: z.string(),
    indentId: z.string(),
});

export const editIndentSchema = createIndentRequestSchema.extend({
    indentId: z.string(),
});

export const createPOItemSchema = z.object({
    materialId: z.string()
        .min(1, { message: "Material is required" }),
    materialName: z.string(),
    unitId: z.string()
        .min(1, { message: "Unit is required" }),
    unitName: z.string(),
    orderedQuantity: z.number()
        .positive("Quantity must be greater than 0"),
    unitPrice: z.number()
        .nonnegative("Price must be 0 or greater"),
    sgstPercent: z.number().min(0).max(100).optional(),
    cgstPercent: z.number().min(0).max(100).optional(),
    indentItemId: z.string().optional(),
});

// Unified PO Schema for both Form and Server
export const createPOSchema = z.object({
    workspaceId: z.string().uuid("Invalid workspace ID").optional(),
    vendorId: z.string().uuid("Invalid vendor ID"),
    projectId: z.string().uuid("Invalid project ID"),

    // Unified fields
    deliveryAddress: z.string()
        .min(1, { message: "Address Line 1 is required" })
        .max(500, { message: "Address must be at most 500 characters" }),
    deliveryAddressLine2: z.string().optional(),
    deliveryCity: z.string().min(1, { message: "City is required" }),
    deliveryState: z.string().min(1, { message: "State is required" }),
    deliveryCountry: z.string().min(1, { message: "Country is required" }),
    deliveryPincode: z.string().optional(),

    deliveryDate: z.date(),
    termsAndConditions: z.string().optional(),
    terms: z.array(z.string())
        .min(1, { message: "At least one term is required" }),

    items: z.array(createPOItemSchema)
        .min(1, { message: "At least one item is required" }),
});

// For backward compatibility / alias
export const createPOFormSchema = createPOSchema;

export type InviteUserSchemaType = z.infer<typeof inviteUserSchema>;
export type WorkSpaceSchemaType = z.infer<typeof workSpaceSchema>;
export type ProjectSchemaType = z.infer<typeof projectSchema>;
export type EditProjectSchemaType = z.infer<typeof editProjectSchema>;
export type TaskSchemaType = z.infer<typeof taskSchema>;
export type SubTaskSchemaType = z.infer<typeof subTaskSchema>;
export type IndentSchemaType = z.infer<typeof indentSchema>;
export type UnitSchemaType = z.infer<typeof unitSchema>;
export type MaterialSchemaType = z.infer<typeof materialSchema>;
export type VendorSchemaType = z.infer<typeof vendorSchema>;
export type MaterialItemType = z.infer<typeof materialIndentItemSchema>;
export type IndentStep1Data = z.infer<typeof indentStep1Schema>;
export type IndentStep2Data = z.infer<typeof indentStep2Schema>;
export type IndentDialogFormData = z.infer<typeof indentDialogSchema>;
export type CreateIndentRequestInput = z.infer<typeof createIndentRequestSchema>;
export type DeleteIndentInput = z.infer<typeof deleteIndentSchema>;
export type EditIndentInput = z.infer<typeof editIndentSchema>;
export type CreatePOItemInput = z.infer<typeof createPOItemSchema>;
// export type CreatePOFormData = z.infer<typeof createPOFormSchema>;
export type CreatePOInput = z.infer<typeof createPOSchema>;
export type UpdateWorkspaceInfoType = z.infer<typeof updateWorkspaceInfoSchema>;

export const dailyReportEntrySchema = z.object({
    id: z.string().optional(),
    taskId: z.string().nullable().optional(), // 'other' explicitly maps to null
    description: z.string().min(15, "Description must be at least 15 characters long."),
});

export const dailyReportSchema = z.object({
    workspaceId: z.string().uuid(),
    date: z.string().optional(), // YYYY-MM-DD format from client
    entries: z.array(dailyReportEntrySchema).min(1, "At least one report entry is required."),
});

export type DailyReportEntryType = z.infer<typeof dailyReportEntrySchema>;
export type DailyReportFormType = z.infer<typeof dailyReportSchema>;
