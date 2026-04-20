import { PrismaClient } from '@prisma/client';
import { getTasks } from '../src/data/task/get-tasks';
import { getWorkspaceTags } from '../src/data/tag/get-tags';
import { getWorkspaceMembers } from '../src/data/workspace/get-workspace-members';
import { getWorkspacePermissions } from '../src/data/user/get-user-permissions';
import { getUserProjects } from '../src/data/project/get-projects';

const prisma = new PrismaClient();

async function runBenchmark() {
    const workspaceId = '52dd2e07-c2a0-46ce-960a-65299f72eebc';
    const userId = 'user_2tNn9V3A6R9tJjWz9fVzXw2R'; // Example user ID

    console.log(`🚀 Starting Load Time Calculation for Workspace: ${workspaceId}\n`);

    const samples = 5;
    let totalDuration = 0;

    for (let i = 1; i <= samples; i++) {
        const start = performance.now();

        // Parallel fetch simulation as in WorkspaceListView
        await Promise.all([
            getWorkspaceTags(workspaceId),
            getWorkspaceMembers(workspaceId),
            getWorkspacePermissions(workspaceId),
            getUserProjects(workspaceId),
            getTasks({
                workspaceId,
                hierarchyMode: "parents",
                includeSubTasks: true,
                page: 1,
                limit: 50,
                includeFacets: true
            })
        ]);

        const duration = performance.now() - start;
        totalDuration += duration;
        console.log(`Sample ${i}: ${duration.toFixed(2)}ms`);
    }

    const average = totalDuration / samples;
    console.log(`\n📊 Result Summary:`);
    console.log(`-----------------------------------`);
    console.log(`Average ERP Workspace Load: ${average.toFixed(2)}ms`);
    console.log(`Approximate User Perceived Delta: ~${(average + 150).toFixed(2)}ms (including hydration)`);
    console.log(`-----------------------------------`);
}

runBenchmark().catch(console.error).finally(() => prisma.$disconnect());
