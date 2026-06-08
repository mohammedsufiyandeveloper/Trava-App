import prisma from "../src/lib/db";

async function main() {
    const user = await prisma.user.findFirst({
        where: { email: "digital@thewhitetusker.com" }
    });
    console.log("USER DETAILS:", JSON.stringify(user, null, 2));
}

main().catch(console.error);
