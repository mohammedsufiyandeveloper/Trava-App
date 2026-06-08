import prisma from "../src/lib/db";

async function main() {
    const workspaces = await prisma.workspace.findMany();
    console.log("WORKSPACES:");
    for (const w of workspaces) {
        console.log(`- [${w.id}] Name: ${w.name} | shiftStartTime: ${w.shiftStartTime} | shiftEndTime: ${w.shiftEndTime} | lateThreshold: ${w.lateThreshold} | halfDayThreshold: ${w.halfDayThreshold}`);
    }
}

main().catch(console.error);
