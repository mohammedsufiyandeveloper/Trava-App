import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

async function checkAllColumns() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    const tables = [
        'Task', 
        'ProjectMember', 
        'WorkspaceMember', 
        'Project',
        'indent_details', 
        'indent_item', 
        'purchase_order', 
        'purchase_order_payment', 
        'unit'
    ];

    try {
        await client.connect();
        for (const table of tables) {
            console.log(`--- Columns for "${table}" ---`);
            const res = await client.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = $1
            `, [table]);
            if (res.rows.length === 0) {
                console.log(`  (Table not found or no columns)`);
                // Try lowercase
                const resLower = await client.query(`
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = $1
                `, [table.toLowerCase()]);
                if (resLower.rows.length > 0) {
                    console.log(`  (Found as lowercase "${table.toLowerCase()}")`);
                    resLower.rows.forEach(r => console.log(`  - ${r.column_name}`));
                }
            } else {
                res.rows.forEach(r => console.log(`  - ${r.column_name}`));
            }
        }
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

checkAllColumns();
