import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("=== RECENT NOTIFICATIONS ===");
    const notifs = await prisma.notification.findMany({
        orderBy: { createdAt: "desc" },
        take: 10
    });
    for (const n of notifs) {
        console.log(`ID: ${n.id}`);
        console.log(`Title: ${n.title}`);
        console.log(`Body: ${n.body}`);
        console.log(`Type: ${n.type}`);
        console.log(`EntityId: ${n.entityId}`);
        console.log(`EntityType: ${n.entityType}`);
        console.log(`Metadata: ${JSON.stringify(n.metadata, null, 2)}`);
        console.log("-----------------------------------------");
    }

    console.log("\n=== RECENT AUDIT LOGS ===");
    const logs = await prisma.audit_log.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
            user: {
                select: { name: true, surname: true }
            }
        }
    });
    for (const l of logs) {
        console.log(`ID: ${l.id}`);
        console.log(`User: ${l.user?.name} ${l.user?.surname}`);
        console.log(`Action: ${l.action}`);
        console.log(`EntityId: ${l.entityId}`);
        console.log(`EntityType: ${l.entityType}`);
        console.log(`Metadata: ${JSON.stringify(l.metadata, null, 2)}`);
        console.log("-----------------------------------------");
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
