import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

async function checkTask() {
    const databaseUrl = process.env.DATABASE_URL;
    const client = new Client({
        connectionString: databaseUrl,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('--- Checking "Task" Columns ---');
        const resCols = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'Task'
        `);
        resCols.rows.forEach(r => console.log(` - ${r.column_name}`));
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

checkTask();
