import { AttendanceService } from "../src/server/services/attendance.service";
import prisma from "../src/lib/db";

async function main() {
    const user = await prisma.user.findFirst({
        where: { email: "accounts@thewhitetusker.com" }
    });
    if (!user) throw new Error("User not found");

    const member = await prisma.workspaceMember.findFirst({
        where: { userId: user.id }
    });
    if (!member) throw new Error("Member not found");

    console.log(`Simulating check-in for user: ${user.email} (memberId: ${member.id})`);
    
    try {
        const result = await AttendanceService.checkIn({
            workspaceId: member.workspaceId,
            userId: user.id,
            latitude: 12.97,
            longitude: 77.63,
            address: "Test Office"
        });
        console.log("Check-in succeeded:", JSON.stringify(result, null, 2));
    } catch (err: any) {
        console.error("Check-in failed with error:", err.message, "statusCode:", err.statusCode);
    }
}

main().catch(console.error);
