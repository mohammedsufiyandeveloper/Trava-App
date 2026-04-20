
const { PrismaClient } = require('@prisma/client');

// Use the ELB hostname that correctly resolves on the user's DNS
const ELB_HOST = 'pool-tcp-aps11-9be1a68-76cb5615320e8fb8.elb.ap-south-1.amazonaws.com';
const URL = `postgresql://postgres.huruairekknyibistusz:cqxnp9mDDCpRPrtq@${ELB_HOST}:6543/postgres?pgbouncer=true`;

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: URL,
        },
    },
});

async function testELB() {
    console.log('--- ELB DNS WORKAROUND TEST ---');
    console.log(`Testing connection to: ${ELB_HOST}`);
    try {
        const start = Date.now();
        const result = await prisma.$queryRaw`SELECT 1`;
        const end = Date.now();
        console.log('✅ Connection Successful via ELB!');
        console.log(`Response time: ${end - start}ms`);
        console.log('Result:', result);
    } catch (e) {
        console.error('❌ Connection Failed even with ELB!');
        console.error('Error Message:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

testELB();
