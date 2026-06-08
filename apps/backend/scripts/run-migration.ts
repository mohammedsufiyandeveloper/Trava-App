import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from .env
dotenv.config();

async function runMigration() {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
        console.error('❌ Error: DATABASE_URL is not defined in .env');
        process.exit(1);
    }

    const sqlPath = path.join(process.cwd(), 'prisma', 'migrations', '20260406_schema_integrity_refactor.sql');
    
    if (!fs.existsSync(sqlPath)) {
        console.error(`❌ Error: Migration file not found at ${sqlPath}`);
        process.exit(1);
    }

    const sql = fs.readFileSync(sqlPath, 'utf8');
    const client = new Client({
        connectionString: databaseUrl,
        ssl: {
            rejectUnauthorized: false // Required for Supabase
        }
    });

    try {
        console.log('🚀 Connecting to database...');
        await client.connect();
        console.log('✅ Connected.');

        console.log('📝 Executing migration script...');
        // listen for notices (RAISE NOTICE in Postgres)
        client.on('notice', (msg) => {
            console.log(`💬 [Notice] ${msg.message}`);
        });

        await client.query(sql);
        console.log('🎉 Migration executed successfully!');
    } catch (err) {
        console.error('❌ Migration failed:');
        console.error(err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

runMigration();
