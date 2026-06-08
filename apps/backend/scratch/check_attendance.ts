import prisma from "../src/lib/db";

async function main() {
    console.log("=== ATTENDANCE RECORDS (LAST 4 DAYS) ===");
    const fourDaysAgo = new Date();
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
    
    const records = await prisma.attendance.findMany({
        where: {
            date: {
                gte: fourDaysAgo
            }
        },
        include: {
            workspaceMember: {
                include: {
                    user: {
                        select: { name: true, surname: true, email: true }
                    }
                }
            }
        },
        orderBy: {
            date: "desc"
        }
    });

    for (const r of records) {
        const userStr = `${r.workspaceMember?.user?.name || ""} ${r.workspaceMember?.user?.surname || ""}`.trim() + ` (${r.workspaceMember?.user?.email})`;
        console.log(`[${r.date.toISOString().split('T')[0]}] User: ${userStr} | checkIn: ${r.checkIn ? r.checkIn.toISOString() : 'NULL'} | checkOut: ${r.checkOut ? r.checkOut.toISOString() : 'NULL'} | Status: ${r.status}`);
    }
}

main().catch(console.error);
