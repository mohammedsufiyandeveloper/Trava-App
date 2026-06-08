import prisma from "../src/lib/db";

async function main() {
    const triggers = await prisma.$queryRaw`
        SELECT trigger_name, event_manipulation, event_object_table, action_statement
        FROM information_schema.triggers
        WHERE event_object_table = 'attendance';
    `;
    console.log("TRIGGERS ON ATTENDANCE TABLE:");
    console.log(JSON.stringify(triggers, null, 2));
}

main().catch(console.error);
