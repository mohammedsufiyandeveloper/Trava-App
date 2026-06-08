import prisma from "../src/lib/db";

async function main() {
    const pgTriggers = await prisma.$queryRaw`
        SELECT tgname, relname 
        FROM pg_trigger 
        JOIN pg_class ON pg_class.oid = tgrelid
        WHERE relname = 'attendance';
    `;
    console.log("PG TRIGGERS FOR ATTENDANCE:");
    console.log(JSON.stringify(pgTriggers, null, 2));
}

main().catch(console.error);
