
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Migrating BLOCKED tasks to CANCELLED...');

    // Use raw SQL to avoid type issues with stale client
    // Assuming table name is "Task" based on schema model name
    try {
        const count = await prisma.$executeRawUnsafe(`UPDATE "Task" SET status = 'CANCELLED'::"TaskStatus" WHERE status = 'BLOCKED'::"TaskStatus"`);
        console.log(`Updated ${count} tasks.`);
    } catch (e) {
        console.error("Error executing raw query:", e);
        // Fallback try w/o casting if enum type name is different
        try {
            const count = await prisma.$executeRawUnsafe(`UPDATE "Task" SET status = 'CANCELLED' WHERE status = 'BLOCKED'`);
            console.log(`Updated ${count} tasks (fallback).`);
        } catch (e2) {
            console.error("Fallback failed:", e2);
        }
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
