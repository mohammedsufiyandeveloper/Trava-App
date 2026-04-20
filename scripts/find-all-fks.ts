import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

async function findAllFKs() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    const tables = [
        'Task', 
        'ProjectMember', 
        'indent_details', 
        'indent_item', 
        'purchase_order', 
        'purchase_order_payment', 
        'unit'
    ];

    try {
        await client.connect();
        console.log('📋 Finding all Foreign Key constraints for remapping tables:');
        
        const res = await client.query(`
            SELECT
                t.relname AS table_name,
                conname AS constraint_name
            FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            WHERE t.relname = ANY($1)
              AND c.contype = 'f'
        `, [tables]);

        res.rows.forEach(r => {
            console.log(` - ${r.table_name}: ${r.constraint_name}`);
        });

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

findAllFKs();
