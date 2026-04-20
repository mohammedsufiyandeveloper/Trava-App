import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function checkProject() {
    const databaseUrl = process.env.DATABASE_URL;
    const client = new Client({
        connectionString: databaseUrl,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('--- Testing "Project" ---');
        const resProject = await client.query('SELECT count(*) FROM "Project"');
        console.log(`✅ "Project" exists. Count: ${resProject.rows[0].count}`);

        console.log('--- Testing "ProjectMember" ---');
        const resPM = await client.query('SELECT count(*) FROM "ProjectMember"');
        console.log(`✅ "ProjectMember" exists. Count: ${resPM.rows[0].count}`);

        console.log('--- Testing "WorkspaceMember" ---');
        const resWM = await client.query('SELECT count(*) FROM "WorkspaceMember"');
        console.log(`✅ "WorkspaceMember" exists. Count: ${resWM.rows[0].count}`);

        console.log('--- Checking "ProjectMember" Columns ---');
        const resCols = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'ProjectMember'
        `);
        resCols.rows.forEach(r => console.log(` - ${r.column_name}`));

    } catch (err) {
        console.error('❌ Error during check:');
        console.error(err);
    } finally {
        await client.end();
    }
}

checkProject();
