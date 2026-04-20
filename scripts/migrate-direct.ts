import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Starting Database Migration via Prisma...');
    
    const sqlPath = path.join(__dirname, '../prisma/migrations/20260406_schema_integrity_refactor.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    try {
        // Execute the entire SQL script as a single raw query
        // executeRawUnsafe is used because the script contains multiple statements and complex logic
        await prisma.$executeRawUnsafe(sql);
        console.log('✅ Migration SQL executed successfully.');
        
        console.log('🔄 Running prisma generate...');
        // We'll run this from the command line instead for better visibility
    } catch (error) {
        console.error('❌ Migration failed:');
        console.error(error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
