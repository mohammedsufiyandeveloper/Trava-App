import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        
        const tables = ['Task', 'ProjectMember', 'WorkspaceMember', 'indent_details'];
        
        for (const table of tables) {
            console.log(`--- Table: ${table} ---`);
            const cols = await client.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = $1
            `, [table]);
            console.log('Columns:', cols.rows);

            const count = await client.query(`SELECT count(*)::int as total FROM "${table}"`);
            console.log('Total Rows:', count.rows[0].total);

            if (count.rows[0].total > 0) {
                const sample = await client.query(`SELECT * FROM "${table}" LIMIT 1`);
                console.log('Sample Row:', sample.rows[0]);
            }
            console.log('\n');
        }

    } catch (err) {
        console.error('Diagnostic failed:', err);
    } finally {
        await client.end();
    }
}

run();
