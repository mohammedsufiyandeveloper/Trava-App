import prisma from "@/lib/db";

async function main() {
    console.log("Deleting all indents...");
    // Delete all indents. Items will cascade delete due to schema relations.
    const deletedIndents = await prisma.indentDetails.deleteMany({});
    console.log(`Deleted ${deletedIndents.count} indents.`);

    // Reset ProcurementTask status
    console.log("Resetting Procurement Tasks 'indentCreated' status...");
    const updatedTasks = await prisma.procurementTask.updateMany({
        data: { indentCreated: false }
    });
    console.log(`Reset ${updatedTasks.count} procurement tasks.`);

    console.log("Done. All indents cleared and tasks reset.");
}

main()
    .catch((e) => {
        console.error("Error clearing indents:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
