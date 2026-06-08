import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

async function inspect() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        
        console.log('--- Task Column Values (First 5) ---');
        const tasks = await client.query('SELECT id, "createdById", "reviewerId", "assigneeId", "projectId" FROM "Task" LIMIT 5');
        console.log(tasks.rows);

        console.log('--- Checking if assigneeId contains User IDs ---');
        const userIdCheck = await client.query('SELECT "assigneeId" FROM "Task" WHERE "assigneeId" IS NOT NULL LIMIT 5');
        console.log('Non-null assigneeIds:', userIdCheck.rows);

        console.log('--- User ID mapping check ---');
        const userMapping = await client.query('SELECT wm.id as wm_id, wm."userId", pm.id as pm_id FROM "WorkspaceMember" wm LEFT JOIN "ProjectMember" pm ON pm."workspaceMemberId" = wm.id LIMIT 5');
        console.log(userMapping.rows);

    } catch (err) {
        console.error('Inspection failed:', err);
    } finally {
        await client.end();
    }
}

inspect();
