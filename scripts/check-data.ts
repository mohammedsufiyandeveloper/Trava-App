import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

async function checkData() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        
        const tables = ['Task', 'indent_details', 'indent_item', 'purchase_order', 'purchase_order_payment', 'unit'];
        
        for(const table of tables) {
            console.log(`--- Checking ${table} ---`);
            const columnsRes = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = '${table}'`);
            const cols = columnsRes.rows.map(r => r.column_name);
            console.log('Columns:', cols.join(', '));
            
            const countRes = await client.query(`SELECT count(*)::int as total FROM "${table}"`);
            console.log('Total rows:', countRes.rows[0].total);
            
            if (countRes.rows[0].total > 0) {
                const sampleRes = await client.query(`SELECT * FROM "${table}" LIMIT 1`);
                console.log('Sample row:', JSON.stringify(sampleRes.rows[0], null, 2));
            }
            console.log('\n');
        }

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

checkData();
