import prisma from "../src/lib/db";

async function main() {
    const customTriggers = await prisma.$queryRaw`
        SELECT tgname, relname 
        FROM pg_trigger 
        JOIN pg_class ON pg_class.oid = tgrelid
        WHERE tgisinternal = false;
    `;
    console.log("CUSTOM TRIGGERS IN DB:");
    console.log(JSON.stringify(customTriggers, null, 2));
}

main().catch(console.error);
