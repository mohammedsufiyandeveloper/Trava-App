import prisma from "../src/lib/db.js";
import dotenv from "dotenv";

dotenv.config();

async function main() {
    console.log("Searching for 'sunayana' in all audit logs...");

    const allLogs = await prisma.audit_log.findMany({
        orderBy: { createdAt: "desc" }
    });

    for (const l of allLogs) {
        const str = JSON.stringify(l).toLowerCase();
        if (str.includes("sunayana")) {
            console.log("-------------------------------------------");
            console.log(`MATCHED LOG: ID: ${l.id}, Action: ${l.action}, EntityId: ${l.entityId}, CreatedAt: ${l.createdAt}`);
            console.log(`Metadata: ${JSON.stringify(l.metadata, null, 2)}`);
        }
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
