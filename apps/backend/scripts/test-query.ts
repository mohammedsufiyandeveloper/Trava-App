import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

async function testUpdate() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Testing specific join query...');
        const sql = `
            SELECT pm.id, wm.id as wm_id
            FROM "ProjectMember" pm
            JOIN "Project" p ON p.id = pm."projectId"
            JOIN "WorkspaceMember" wm ON wm."userId" = pm."userId" AND wm."workspaceId" = p."workspaceId"
            LIMIT 1;
        `;
        const res = await client.query(sql);
        console.log('✅ Query success:', res.rows);
    } catch (err) {
        console.error('❌ Query failed:');
        console.error(err);
    } finally {
        await client.end();
    }
}

testUpdate();
