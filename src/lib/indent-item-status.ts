import { IndentItemStatus } from"@prisma/client";


export type StatusBadgeInfo = {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    color: string;
    description: string;
};

export function getIndentItemStatusInfo(status: IndentItemStatus): StatusBadgeInfo {
    switch (status) {
        case "PENDING":
            return {
                label: "Awaiting Approval",
                variant: "outline",
                color: "text-yellow-600 border-yellow-600",
                description: "Waiting for admin to approve quantity",
            };
        case "QUANTITY_APPROVED":
            return {
                label: "Add Vendor Details",
                variant: "secondary",
                color: "text-blue-600 bg-blue-50",
                description: "Quantity approved - add vendor and price",
            };
        case "VENDOR_PENDING":
            return {
                label: "Awaiting Final Approval",
                variant: "outline",
                color: "text-orange-600 border-orange-600",
                description: "Waiting for admin to approve vendor and price",
            };
        case "APPROVED":
            return {
                label: "Approved",
                variant: "default",
                color: "text-green-600 bg-green-50",
                description: "Fully approved and ready for procurement",
            };
        case "REJECTED":
            return {
                label: "Rejected",
                variant: "destructive",
                color: "text-red-600 bg-red-50",
                description: "Rejected by admin",
            };
        default:
            return {
                label: "Unknown",
                variant: "outline",
                color: "text-gray-600",
                description: "Unknown status",
            };
    }
}

export function canApproveQuantity(status: IndentItemStatus): boolean {
    return status === "PENDING";
}

export function canApproveFinal(status: IndentItemStatus, hasVendor: boolean, hasPrice: boolean): boolean {
    return (
        (status === "VENDOR_PENDING" || status === "PENDING") &&
        hasVendor &&
        hasPrice
    );
}

export function canAddVendor(status: IndentItemStatus): boolean {
    return status === "QUANTITY_APPROVED" || status === "PENDING";
}

export function canReject(status: IndentItemStatus): boolean {
    return status !== "REJECTED" && status !== "APPROVED";
}
