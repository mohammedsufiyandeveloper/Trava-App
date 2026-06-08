import prisma from "../src/lib/db.js";
import dotenv from "dotenv";

dotenv.config();

async function main() {
    console.log("Fetching latest audit logs...");
    const logs = await prisma.audit_log.findMany({
        where: {
            action: "MEMBER_REMOVED"
        },
        orderBy: { createdAt: "desc" },
        take: 3
    });

    console.log(`FOUND ${logs.length} AUDIT LOGS:`);
    for (const l of logs) {
        console.log("------------------------------------------------");
        console.log(`ID: ${l.id}`);
        console.log(`Action: ${l.action}`);
        console.log(`UserId: ${l.userId}`);
        console.log(`WorkspaceId: ${l.workspaceId}`);
        console.log(`Metadata: ${JSON.stringify(l.metadata, null, 2)}`);
        console.log(`CreatedAt: ${l.createdAt}`);
    }
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
