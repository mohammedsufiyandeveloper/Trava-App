"use server";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import prisma from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";
import { CacheTags } from "@/data/cache-tags";

/**
 * Client data type
 */
export interface ProjectClientData {
    companyName: string | null;
    registeredCompanyName: string | null;
    directorName: string | null;
    address: string | null;
    gstNumber: string | null;
    contactPerson: string | null;
    phoneNumber: string | null;
}

/**
 * Internal function to fetch project client data
 */
async function _getProjectClientInternal(projectId: string): Promise<ProjectClientData> {
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
            clint: {
                include: {
                    clintMembers: true,
                },
            },
        },
    });

    if (!project || !project.clint || project.clint.length === 0) {
        notFound();
    }

    // Get client data (first client if exists)
    const clientRecord = project.clint[0];
    const clientMember = clientRecord?.clintMembers?.[0];

    return {
        companyName: clientRecord?.name || null,
        registeredCompanyName: clientRecord?.registeredCompanyName || null,
        directorName: clientRecord?.directorName || null,
        address: clientRecord?.address || null,
        gstNumber: clientRecord?.gstNumber || null,
        contactPerson: clientMember?.name || null,
        phoneNumber: clientMember?.phoneNumber || null,
    };
}

/**
 * Cached version using Next.js unstable_cache
 */
const getCachedProjectClient = (projectId: string) =>
    unstable_cache(
        async () => _getProjectClientInternal(projectId),
        [`project-client-${projectId}`],
        {
            tags: CacheTags.projectClient(projectId),
            revalidate: 60 // 1 minute - client data doesn't change often
        }
    )();

/**
 * Fetch project client data
 * 
 * Behavior:
 * - Validates user authentication
 * - Fetches client information for a project (cached)
 * - Triggers 404 page if no client data exists
 * 
 * Caching Strategy:
 * 1. React cache() - Deduplicates requests within the same render
 * 2. unstable_cache() - Persists data across requests for 1 minute
 * 
 * Cache Invalidation:
 * - Use revalidateTag(`project-client-${projectId}`) to invalidate specific project client
 * - Use revalidateTag(`project-${projectId}`) to invalidate all project data
 * 
 * @param projectId - The project ID
 * @returns Client data (never null - triggers 404 instead)
 * @throws {notFound} When no client data exists for the project
 * 
 * @example
 * const clientData = await getProjectClient(projectId);
 * // Always has data here - 404 page shown if not found
 * console.log(clientData.companyName);
 * console.log(clientData.contactPerson);
 */
export const getProjectClient = cache(async (projectId: string): Promise<ProjectClientData> => {
    await requireUser();

    return await getCachedProjectClient(projectId);
});

export type ProjectClientType = Awaited<ReturnType<typeof getProjectClient>>;
