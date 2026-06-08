import prisma from "../src/lib/db.js";
import dotenv from "dotenv";

dotenv.config();

async function main() {
    console.log("Fetching deletion notifications...");
    const notifs = await prisma.notification.findMany({
        where: {
            type: {
                in: ["SUBTASK_DELETED", "TASK_DELETED"]
            }
        },
        orderBy: { createdAt: "desc" },
    });

    console.log(`FOUND ${notifs.length} DELETION NOTIFICATIONS:`);
    for (const n of notifs) {
        console.log("------------------------------------------------");
        console.log(`ID: ${n.id}`);
        console.log(`Title: ${n.title}`);
        console.log(`Body: ${n.body}`);
        console.log(`Type: ${n.type}`);
        console.log(`EntityType: ${n.entityType}`);
        console.log(`EntityId: ${n.entityId}`);
        console.log(`Metadata Type: ${typeof n.metadata}`);
        console.log(`Metadata: ${JSON.stringify(n.metadata, null, 2)}`);
        console.log(`CreatedAt: ${n.createdAt}`);
    }
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
