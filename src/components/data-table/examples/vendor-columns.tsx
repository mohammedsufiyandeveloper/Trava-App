"use client";

import { ColumnDef } from "@tanstack/react-table";
import {
    createSelectColumn,
    createActionsColumn,
    createTextColumn,
    createDateColumn,
    createBadgeColumn,
} from "@/components/data-table/column-helpers";
import { Edit, Trash, Eye, Mail, Phone, MapPin } from "lucide-react";

// Example Vendor type (you'll need to create this model in Prisma)
export type Vendor = {
    id: string;
    name: string;
    companyName: string | null;
    gstNumber: string | null;
    contactPerson: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    category: string | null; // e.g., "Materials", "Services", "Equipment"
    rating: number | null; // 1-5 rating
    isActive: boolean;
    createdAt: Date;
};

export function createVendorColumns(
    onEdit: (vendor: Vendor) => void,
    onDelete: (vendor: Vendor) => void,
    onView: (vendor: Vendor) => void
): ColumnDef<Vendor>[] {
    return [
        createSelectColumn<Vendor>(),

        {
            accessorKey: "name",
            header: "Vendor",
            cell: ({ row }) => {
                const vendor = row.original;
                return (
                    <div className="flex flex-col">
                        <span className="font-semibold">{vendor.name}</span>
                        {vendor.companyName && (
                            <span className="text-xs text-muted-foreground">{vendor.companyName}</span>
                        )}
                    </div>
                );
            },
        },

        {
            accessorKey: "contactPerson",
            header: "Contact Person",
            cell: ({ row }) => {
                const vendor = row.original;
                if (!vendor.contactPerson) return <span className="text-muted-foreground">—</span>;

                return (
                    <div className="flex flex-col gap-1">
                        <span className="font-medium">{vendor.contactPerson}</span>
                        {vendor.email && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                {vendor.email}
                            </div>
                        )}
                        {vendor.phone && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                {vendor.phone}
                            </div>
                        )}
                    </div>
                );
            },
        },

        createTextColumn<Vendor>("gstNumber", "GST Number"),

        createTextColumn<Vendor>("category", "Category", {
            className: "capitalize",
        }),

        {
            accessorKey: "rating",
            header: "Rating",
            cell: ({ row }) => {
                const rating = row.getValue("rating") as number | null;
                if (!rating) return <span className="text-muted-foreground">—</span>;

                return (
                    <div className="flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <span
                                key={i}
                                className={i < rating ? "text-yellow-500" : "text-gray-300"}
                            >
                                ★
                            </span>
                        ))}
                        <span className="ml-1 text-sm text-muted-foreground">({rating})</span>
                    </div>
                );
            },
        },

        {
            accessorKey: "address",
            header: "Location",
            cell: ({ row }) => {
                const address = row.getValue("address") as string | null;
                if (!address) return <span className="text-muted-foreground">—</span>;

                return (
                    <div className="flex items-start gap-2 max-w-xs">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <span className="text-sm line-clamp-2" title={address}>
                            {address}
                        </span>
                    </div>
                );
            },
        },

        createBadgeColumn<Vendor>("isActive", "Status", {
            true: "default",
            false: "secondary",
        }),

        createDateColumn<Vendor>("createdAt", "Added", "relative"),

        createActionsColumn<Vendor>([
            {
                label: "View Details",
                onClick: onView,
                icon: <Eye className="h-4 w-4" />,
            },
            {
                label: "Edit",
                onClick: onEdit,
                icon: <Edit className="h-4 w-4" />,
            },
            {
                label: "Delete",
                onClick: onDelete,
                icon: <Trash className="h-4 w-4" />,
                variant: "destructive",
            },
        ]),
    ];
}
