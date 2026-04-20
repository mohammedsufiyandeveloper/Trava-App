import prisma from "@/lib/db";
import slugify from "slugify";

/**
 * Generate a unique slug by checking against existing slugs in the database
 * and appending numbers if conflicts are found
 * 
 * @param baseName - The base name to generate slug from
 * @param tableName - The database table to check against ('task', 'project', etc.)
 * @param prefix - Optional prefix to add before the slug (e.g., parent task slug)
 * @param existingSlugs - Optional array of slugs to also check against (for batch operations)
 * @returns A unique slug that doesn't conflict with existing records
 * 
 * @example
 * // Simple usage
 * const slug = await generateUniqueSlug("Foundation Work", "task");
 * // Returns: "foundation-work" or "foundation-work-1" if exists
 * 
 * @example
 * // With prefix (for subtasks)
 * const slug = await generateUniqueSlug("Install Wiring", "task", "electrical-work");
 * // Returns: "electrical-work-install-wiring" or "electrical-work-install-wiring-1"
 * 
 * @example
 * // Batch operation with existing slugs
 * const slugs = [];
 * for (const name of names) {
 *   const slug = await generateUniqueSlug(name, "task", undefined, slugs);
 *   slugs.push(slug);
 * }
 */
export async function generateUniqueSlug(
    baseName: string,
    tableName: 'task' | 'project' | 'workspace',
    prefix?: string,
    existingSlugs: string[] = []
): Promise<string> {
    // Generate base slug from name
    const baseSlug = slugify(baseName, { lower: true, strict: true });

    // Add prefix if provided
    const fullBaseSlug = prefix ? `${prefix}-${baseSlug}` : baseSlug;

    // Get existing slugs from database that start with this base
    let dbSlugs: string[] = [];

    switch (tableName) {
        case 'task':
            const tasks = await prisma.task.findMany({
                where: {
                    taskSlug: {
                        startsWith: fullBaseSlug
                    }
                },
                select: { taskSlug: true }
            });
            dbSlugs = tasks.map((t: { taskSlug: string }) => t.taskSlug);
            break;

        case 'project':
            const projects = await prisma.project.findMany({
                where: {
                    slug: {
                        startsWith: fullBaseSlug
                    }
                },
                select: { slug: true }
            });
            dbSlugs = projects.map((p: { slug: string }) => p.slug);
            break;

        case 'workspace':
            const workspaces = await prisma.workspace.findMany({
                where: {
                    slug: {
                        startsWith: fullBaseSlug
                    }
                },
                select: { slug: true }
            });
            dbSlugs = workspaces.map((w: { slug: string }) => w.slug);
            break;
    }

    // Combine database slugs with provided existing slugs
    const allExistingSlugs = new Set([...dbSlugs, ...existingSlugs]);

    // If no conflict, return the base slug
    if (!allExistingSlugs.has(fullBaseSlug)) {
        return fullBaseSlug;
    }

    // Find next available number
    let counter = 1;
    let uniqueSlug = `${fullBaseSlug}-${counter}`;

    while (allExistingSlugs.has(uniqueSlug)) {
        counter++;
        uniqueSlug = `${fullBaseSlug}-${counter}`;
    }

    return uniqueSlug;
}

/**
 * Generate multiple unique slugs in batch
 * This is more efficient than calling generateUniqueSlug multiple times
 * as it tracks generated slugs to prevent duplicates within the batch
 * 
 * @param names - Array of names to generate slugs from
 * @param tableName - The database table to check against
 * @param prefix - Optional prefix to add before each slug
 * @returns Array of unique slugs in the same order as input names
 * 
 * @example
 * const names = ["Foundation Work", "Foundation Work", "Electrical"];
 * const slugs = await generateUniqueSlugs(names, "task");
 * // Returns: ["foundation-work", "foundation-work-1", "electrical"]
 * 
 * @example
 * // With prefix for subtasks
 * const slugs = await generateUniqueSlugs(
 *   ["Install", "Install", "Test"],
 *   "task",
 *   "electrical-work"
 * );
 * // Returns: [
 * //   "electrical-work-install",
 * //   "electrical-work-install-1",
 * //   "electrical-work-test"
 * // ]
 */
export async function generateUniqueSlugs(
    names: string[],
    tableName: 'task' | 'project' | 'workspace',
    prefix?: string,
    existingSlugs: string[] = []
): Promise<string[]> {
    if (names.length === 0) return [];

    // 1. Generate all base slugs
    const nameData = names.map(name => {
        const baseSlug = slugify(name, { lower: true, strict: true });
        const fullBaseSlug = prefix ? `${prefix}-${baseSlug}` : baseSlug;
        return { name, fullBaseSlug };
    });

    // 2. Fetch all conflicting slugs from DB in ONE query
    const baseSlugs = Array.from(new Set(nameData.map(d => d.fullBaseSlug)));
    let dbSlugs: string[] = [];

    const whereClause = {
        OR: baseSlugs.map(bs => ({
            [tableName === 'task' ? 'taskSlug' : 'slug']: { startsWith: bs }
        }))
    };

    switch (tableName) {
        case 'task':
            const tasks = await prisma.task.findMany({
                where: whereClause as any,
                select: { taskSlug: true }
            });
            dbSlugs = tasks.map(t => t.taskSlug);
            break;
        case 'project':
            const projects = await prisma.project.findMany({
                where: whereClause as any,
                select: { slug: true }
            });
            dbSlugs = projects.map(p => p.slug);
            break;
        case 'workspace':
            const workspaces = await prisma.workspace.findMany({
                where: whereClause as any,
                select: { slug: true }
            });
            dbSlugs = workspaces.map(w => w.slug);
            break;
    }

    // 3. Resolve conflicts in-memory
    const allExistingSlugs = new Set([...dbSlugs, ...existingSlugs]);
    const results: string[] = [];

    for (const data of nameData) {
        let uniqueSlug = data.fullBaseSlug;

        if (allExistingSlugs.has(uniqueSlug)) {
            let counter = 1;
            uniqueSlug = `${data.fullBaseSlug}-${counter}`;
            while (allExistingSlugs.has(uniqueSlug)) {
                counter++;
                uniqueSlug = `${data.fullBaseSlug}-${counter}`;
            }
        }

        results.push(uniqueSlug);
        allExistingSlugs.add(uniqueSlug); // Add to set so subsequent items in this batch don't collide
    }

    return results;
}

/**
 * Check if a slug already exists in the database
 * 
 * @param slug - The slug to check
 * @param tableName - The database table to check against
 * @returns true if slug exists, false otherwise
 * 
 * @example
 * const exists = await slugExists("foundation-work", "task");
 * if (exists) {
 *   console.log("Slug already taken!");
 * }
 */
export async function slugExists(
    slug: string,
    tableName: 'task' | 'project' | 'workspace'
): Promise<boolean> {
    switch (tableName) {
        case 'task':
            const task = await prisma.task.findFirst({
                where: { taskSlug: slug },
                select: { id: true }
            });
            return !!task;

        case 'project':
            const project = await prisma.project.findFirst({
                where: { slug },
                select: { id: true }
            });
            return !!project;

        case 'workspace':
            const workspace = await prisma.workspace.findFirst({
                where: { slug },
                select: { id: true }
            });
            return !!workspace;
    }
}
