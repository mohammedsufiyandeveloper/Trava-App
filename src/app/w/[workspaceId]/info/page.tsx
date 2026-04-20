import { getWorkspaceById } from "@/data/workspace/get-workspace-by-id";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Building2, MapPin, Phone, Mail, Globe, IdCard } from "lucide-react";
import { WorkspaceInfoForm } from "./_components/workspace-info-form";
import { getWorkspacePermissions } from "@/data/user/get-user-permissions";

export const revalidate = 300; // Revalidate every 5 minutes (semi-static)

interface InfoPageProps {
    params: Promise<{
        workspaceId: string;
    }>;
}

// Helper to render a detail row
const DetailRow = ({ label, value, icon: Icon }: { label: string; value: string | null | undefined, icon?: React.ElementType }) => {
    if (!value) return null;
    return (
        <div className="flex items-start py-3 border-b last:border-0 border-border/50">
            {Icon && <Icon className="w-5 h-5 mr-3 text-muted-foreground mt-0.5 shrink-0" />}
            <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground mb-1">{label}</p>
                <p className="text-base font-semibold text-foreground">{value}</p>
            </div>
        </div>
    );
};

export default async function InfoPage({ params }: InfoPageProps) {
    const { workspaceId } = await params;
    const [workspace, permissions] = await Promise.all([
        getWorkspaceById(workspaceId),
        getWorkspacePermissions(workspaceId)
    ]);

    if (!workspace) {
        notFound();
    }

    const canEdit = permissions.isWorkspaceAdmin;

    if (canEdit) {
        return (
            <div className="container mx-auto py-0 space-y-8">
                <WorkspaceInfoForm workspace={workspace} />
            </div>
        );
    }

    // Read-only view for non-admins

    const hasAddress = workspace.addressLine1 || workspace.city || workspace.state || workspace.country || workspace.pincode;

    // Format address
    const addressParts = [
        workspace.addressLine1,
        workspace.addressLine2,
        workspace.city,
        workspace.state,
        workspace.pincode,
        workspace.country
    ].filter(Boolean);

    return (
        <div className="container mx-auto py-0 space-y-8">
            <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Workspace Information</h1>
                <p className="text-muted-foreground">
                    View organizational and legal details for {workspace.name}.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* General & Legal Info */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Building2 className="w-5 h-5" />
                            Organization Details
                        </CardTitle>
                        <CardDescription>Legal and registration information</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-1">
                        <DetailRow label="Workspace Name" value={workspace.name} />
                        <DetailRow label="Legal Entity Name" value={workspace.legalName} />
                        <DetailRow label="Industry" value={workspace.industry} />
                        <DetailRow label="Company Type" value={workspace.companyType} />
                        <DetailRow label="GST Number" value={workspace.gstNumber} icon={IdCard} />
                        <DetailRow label="PAN Number" value={workspace.panNumber} icon={IdCard} />
                        <DetailRow label="MSME Number" value={workspace.msmeNumber} icon={IdCard} />
                        <DetailRow label="Description" value={workspace.description} />
                    </CardContent>
                </Card>

                {/* Contact & Address */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <MapPin className="w-5 h-5" />
                            Contact & Location
                        </CardTitle>
                        <CardDescription>Address and communication details</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-1">
                        <DetailRow label="Email" value={workspace.email} icon={Mail} />
                        <DetailRow label="Phone" value={workspace.phone} icon={Phone} />
                        <DetailRow label="Website" value={workspace.website} icon={Globe} />

                        {hasAddress && (
                            <div className="flex items-start py-3 border-b last:border-0 border-border/50">
                                <MapPin className="w-5 h-5 mr-3 text-muted-foreground mt-0.5 shrink-0" />
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-muted-foreground mb-1">Registered Address</p>
                                    <p className="text-base text-foreground whitespace-pre-line leading-relaxed">
                                        {addressParts.join('\n')}
                                    </p>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
