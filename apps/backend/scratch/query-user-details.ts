import prisma from "../src/lib/db.js";
import dotenv from "dotenv";

dotenv.config();

async function main() {
    const targetEntityId = "cd670c7c-22b7-4ddb-8262-fa8edb2c372d";

    // 1. Fetch all audit logs for this entityId
    const logs = await prisma.audit_log.findMany({
        where: { entityId: targetEntityId }
    });

    console.log("=== AUDIT LOGS FOR ENTITY ===");
    for (const l of logs) {
        console.log(`Log ID: ${l.id}, Action: ${l.action}, ActorUserId: ${l.userId}, Metadata: ${JSON.stringify(l.metadata, null, 2)}`);
    }

    // 2. Try to find any other logs in the system that might belong to the same user (e.g. by comparing the email or userId)
    // Let's find if there are any other audit logs for actions like MEMBER_INVITED with the same userId or email if it was logged.
    // Wait, let's fetch all MEMBER_INVITED logs in the database.
    const invites = await prisma.audit_log.findMany({
        where: { action: "MEMBER_INVITED" }
    });

    console.log("\n=== RECENT MEMBER_INVITED LOGS IN SYSTEM ===");
    for (const i of invites) {
        console.log(`Invite ID: ${i.id}, EntityId (MemberId): ${i.entityId}, Metadata: ${JSON.stringify(i.metadata, null, 2)}`);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
