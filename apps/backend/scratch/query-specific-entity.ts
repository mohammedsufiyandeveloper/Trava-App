import prisma from "../src/lib/db.js";
import dotenv from "dotenv";

dotenv.config();

async function main() {
    const targetEntityId = "cd670c7c-22b7-4ddb-8262-fa8edb2c372d";
    console.log(`Querying records for entityId: ${targetEntityId}...`);

    const notifs = await prisma.notification.findMany({
        where: { entityId: targetEntityId },
    });
    console.log(`FOUND ${notifs.length} NOTIFICATIONS:`);
    for (const n of notifs) {
        console.log(`- ID: ${n.id}, Type: ${n.type}, Title: ${n.title}, Body: ${n.body}, Metadata: ${JSON.stringify(n.metadata)}`);
    }

    const logs = await prisma.audit_log.findMany({
        where: { entityId: targetEntityId },
    });
    console.log(`FOUND ${logs.length} AUDIT LOGS:`);
    for (const l of logs) {
        console.log(`- ID: ${l.id}, Action: ${l.action}, Metadata: ${JSON.stringify(l.metadata)}`);
    }

    // Also look up any MEMBER_INVITED logs in the workspace to see what entityIds they have
    console.log("\nRecent MEMBER_INVITED audit logs in workspace:");
    const recentInvites = await prisma.audit_log.findMany({
        where: { action: "MEMBER_INVITED" },
        orderBy: { createdAt: "desc" },
        take: 5
    });
    for (const ri of recentInvites) {
        console.log(`- ID: ${ri.id}, EntityId: ${ri.entityId}, Metadata: ${JSON.stringify(ri.metadata)}`);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
