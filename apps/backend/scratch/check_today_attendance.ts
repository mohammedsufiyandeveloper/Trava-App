import prisma from "../src/lib/db";

async function main() {
    const today = new Date("2026-06-05T00:00:00.000Z");
    const records = await prisma.attendance.findMany({
        where: {
            date: today
        },
        include: {
            workspaceMember: {
                include: {
                    user: {
                        select: { name: true, surname: true, email: true }
                    }
                }
            }
        }
    });

    console.log(`FOUND ${records.length} RECORDS FOR 2026-06-05:`);
    for (const r of records) {
        const userStr = `${r.workspaceMember?.user?.name || ""} ${r.workspaceMember?.user?.surname || ""}`.trim() + ` (${r.workspaceMember?.user?.email})`;
        console.log(`User: ${userStr} | ID: ${r.id} | checkIn: ${r.checkIn ? r.checkIn.toISOString() : 'NULL'} | checkOut: ${r.checkOut ? r.checkOut.toISOString() : 'NULL'} | Status: ${r.status} | createdAt: ${r.createdAt.toISOString()}`);
    }
}

main().catch(console.error);
