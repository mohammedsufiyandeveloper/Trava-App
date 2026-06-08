import prisma from "../src/lib/db";

async function main() {
    console.log("Server current time:", new Date().toISOString());

    console.log("\n=== AUDIT LOGS (LAST 2 DAYS) ===");
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const logs = await prisma.audit_log.findMany({
        where: {
            createdAt: {
                gte: twoDaysAgo
            }
        },
        orderBy: {
            createdAt: "desc"
        },
        take: 30
    });

    for (const log of logs) {
        console.log(`[${log.createdAt.toISOString()}] User: ${log.userId} | Action: ${log.action} | EntityType: ${log.entityType} | EntityId: ${log.entityId} | Metadata: ${JSON.stringify(log.metadata)}`);
    }
}

main().catch(console.error);
