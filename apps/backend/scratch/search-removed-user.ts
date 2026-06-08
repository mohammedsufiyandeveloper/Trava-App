import prisma from "../src/lib/db.js";
import dotenv from "dotenv";

dotenv.config();

async function main() {
    console.log("Searching for designation 'Interior Designer' or workspaceMember cd670c7c-22b7-4ddb-8262-fa8edb2c372d...");

    // 1. Search all audit logs to find any mention of "Interior Designer" or the target member id
    const allLogs = await prisma.audit_log.findMany({
        orderBy: { createdAt: "desc" }
    });

    console.log(`Searching through ${allLogs.length} audit logs...`);
    for (const l of allLogs) {
        const str = JSON.stringify(l);
        if (str.includes("Interior Designer") || str.includes("cd670c7c-22b7-4ddb-8262-fa8edb2c372d")) {
            console.log("-------------------------------------------");
            console.log(`MATCHED LOG: ID: ${l.id}, Action: ${l.action}, EntityId: ${l.entityId}, CreatedAt: ${l.createdAt}`);
            console.log(`Metadata: ${JSON.stringify(l.metadata, null, 2)}`);
        }
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
