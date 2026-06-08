import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

async function findConstraints() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const res = await client.query(`
            SELECT
                conname AS constraint_name,
                contype AS constraint_type
            FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            WHERE t.relname = 'Task'
        `);
        console.log('📋 Constraints on "Task" table:');
        res.rows.forEach(r => console.log(` - ${r.constraint_name} (${r.constraint_type})`));
        
        const resPM = await client.query(`
            SELECT
                conname AS constraint_name,
                contype AS constraint_type
            FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            WHERE t.relname = 'ProjectMember'
        `);
        console.log('\n📋 Constraints on "ProjectMember" table:');
        resPM.rows.forEach(r => console.log(` - ${r.constraint_name} (${r.constraint_type})`));

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

findConstraints();
