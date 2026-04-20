import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function listTables() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        console.error('DATABASE_URL missing');
        process.exit(1);
    }

    const client = new Client({
        connectionString: databaseUrl,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const res = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name;
        `);
        console.log('📋 Tables in public schema:');
        res.rows.forEach(row => console.log(` - ${row.table_name}`));
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

listTables();
