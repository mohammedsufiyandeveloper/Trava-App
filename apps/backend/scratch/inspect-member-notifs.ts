import prisma from "../src/lib/db.js";
import dotenv from "dotenv";

dotenv.config();

async function main() {
    console.log("Fetching member notifications...");
    const invites = await prisma.notification.findMany({
        where: {
            type: "MEMBER_INVITED"
        },
        orderBy: { createdAt: "desc" },
        take: 3
    });

    console.log(`FOUND ${invites.length} MEMBER_INVITED NOTIFICATIONS:`);
    for (const n of invites) {
        console.log("------------------------------------------------");
        console.log(`ID: ${n.id}`);
        console.log(`Title: ${n.title}`);
        console.log(`Body: ${n.body}`);
        console.log(`Type: ${n.type}`);
        console.log(`EntityType: ${n.entityType}`);
        console.log(`EntityId: ${n.entityId}`);
        console.log(`Metadata: ${JSON.stringify(n.metadata, null, 2)}`);
        console.log(`CreatedAt: ${n.createdAt}`);
    }

    const removes = await prisma.notification.findMany({
        where: {
            type: "MEMBER_REMOVED"
        },
        orderBy: { createdAt: "desc" },
        take: 3
    });

    console.log(`FOUND ${removes.length} MEMBER_REMOVED NOTIFICATIONS:`);
    for (const n of removes) {
        console.log("------------------------------------------------");
        console.log(`ID: ${n.id}`);
        console.log(`Title: ${n.title}`);
        console.log(`Body: ${n.body}`);
        console.log(`Type: ${n.type}`);
        console.log(`EntityType: ${n.entityType}`);
        console.log(`EntityId: ${n.entityId}`);
        console.log(`Metadata: ${JSON.stringify(n.metadata, null, 2)}`);
        console.log(`CreatedAt: ${n.createdAt}`);
    }
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
