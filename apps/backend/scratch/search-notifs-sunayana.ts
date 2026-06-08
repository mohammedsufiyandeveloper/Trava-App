import prisma from "../src/lib/db.js";
import dotenv from "dotenv";

dotenv.config();

async function main() {
    console.log("Searching for notifications related to Sunayana's IDs...");

    const notifs = await prisma.notification.findMany();
    console.log(`Searching through ${notifs.length} notifications...`);

    for (const n of notifs) {
        const str = JSON.stringify(n).toLowerCase();
        if (str.includes("cd670c7c") || str.includes("7721cb") || str.includes("sunayana")) {
            console.log("-------------------------------------------");
            console.log(`Notification ID: ${n.id}`);
            console.log(`Title: ${n.title}`);
            console.log(`Body: ${n.body}`);
            console.log(`Type: ${n.type}`);
            console.log(`EntityId: ${n.entityId}`);
            console.log(`Metadata: ${JSON.stringify(n.metadata, null, 2)}`);
        }
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
