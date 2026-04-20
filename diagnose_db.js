
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function diagnose() {
    console.log('--- DB DIAGNOSIS ---');
    console.log('Testing connection to Supabase...');
    try {
        const start = Date.now();
        const result = await prisma.$queryRaw`SELECT 1`;
        const end = Date.now();
        console.log('✅ Connection Successful!');
        console.log(`Response time: ${end - start}ms`);
        console.log('Result:', result);
    } catch (e) {
        console.error('❌ Connection Failed!');
        console.error('Error Name:', e.name);
        console.error('Error Message:', e.message);
        console.error('Error Code:', e.code);
    } finally {
        await prisma.$disconnect();
    }
}

diagnose();
