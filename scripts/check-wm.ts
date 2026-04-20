import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

async function checkWM() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('--- Checking "WorkspaceMember" Columns ---');
        const resCols = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'WorkspaceMember'
        `);
        resCols.rows.forEach(r => console.log(` - ${r.column_name}`));
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

checkWM();
