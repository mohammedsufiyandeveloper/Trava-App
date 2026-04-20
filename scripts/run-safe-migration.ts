import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Splits a SQL script into individual statements for execution.
 * Handles:
 * - Simple statements ending in ';'
 * - DO $$ ... END $$ blocks (preserves them as one statement)
 * - Single quotes and escape sequences
 */
function splitSqlStatements(sql: string): string[] {
    const statements: string[] = [];
    let current = '';
    let inDollarBlock = false;
    let inSingleQuote = false;

    // Clean up comments first (simple regex for -- and /* */)
    // Actually, we'll iterate char by char for 100% accuracy.
    for (let i = 0; i < sql.length; i++) {
        const char = sql[i];
        const nextChar = sql[i + 1] || '';

        // Handle single-line comments --
        if (!inDollarBlock && !inSingleQuote && char === '-' && nextChar === '-') {
            while (i < sql.length && sql[i] !== '\n') i++;
            continue;
        }

        // Handle multi-line comments /* */
        if (!inDollarBlock && !inSingleQuote && char === '/' && nextChar === '*') {
            i += 2;
            while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/')) i++;
            i++;
            continue;
        }

        // Handle dollar quote blocks $$
        if (char === '$' && nextChar === '$') {
            inDollarBlock = !inDollarBlock;
            current += '$$';
            i++;
            continue;
        }

        // Handle single quotes (if not in dollar block)
        if (!inDollarBlock && char === "'") {
            // Check for escaped single quote ''
            if (nextChar === "'") {
                current += "''";
                i++;
                continue;
            }
            inSingleQuote = !inSingleQuote;
            current += char;
            continue;
        }

        // Handle statement terminator ;
        if (char === ';' && !inDollarBlock && !inSingleQuote) {
            current += ';';
            if (current.trim()) statements.push(current.trim());
            current = '';
            continue;
        }

        current += char;
    }

    if (current.trim()) {
        statements.push(current.trim());
    }

    return statements;
}

async function runSafeMigration() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        console.error('❌ Error: DATABASE_URL missing');
        process.exit(1);
    }

    const sqlPath = path.join(process.cwd(), 'prisma', 'migrations', '20260406_schema_integrity_refactor.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    const statements = splitSqlStatements(sql);
    console.log(`📄 Found ${statements.length} SQL statements to execute.`);

    const client = new Client({
        connectionString: databaseUrl,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('🚀 Connecting to database...');
        await client.connect();

        // Use a single transaction for the whole sequence if possible
        console.log('🔒 Starting migration transaction...');
        await client.query('BEGIN');

        for (let i = 0; i < statements.length; i++) {
            const stmt = statements[i];
            
            // Skip BEGIN/COMMIT if they appear in the file since we handle it manually here
            if (stmt.toUpperCase().startsWith('BEGIN') || stmt.toUpperCase().startsWith('COMMIT')) {
                continue;
            }

            console.log(`📝 [${i + 1}/${statements.length}] Executing statement: ${stmt.substring(0, 50).replace(/\n/g, ' ')}...`);
            
            // Log notices
            client.on('notice', (msg) => {
                console.log(`💬 [Notice] ${msg.message}`);
            });

            await client.query(stmt);
        }

        await client.query('COMMIT');
        console.log('🎉 Migration completed successfully!');
    } catch (error) {
        console.error('❌ Migration failed, rolling back...');
        console.error(error);
        try {
            await client.query('ROLLBACK');
        } catch (rollbackError) {
            console.error('❌ Rollback failed:', rollbackError);
        }
        process.exit(1);
    } finally {
        await client.end();
    }
}

runSafeMigration();
