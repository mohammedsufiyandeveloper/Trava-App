"use server";

import prisma from "@/lib/db";

/**
 * Synchronizes additional user profile fields using Raw SQL.
 * This is used to bypass Prisma Client validation errors when the client
 * is out of sync with the database schema (common on Windows).
 */
export async function syncUserProfile({
  userId,
  surname,
  phoneNumber,
}: {
  userId: string;
  surname?: string | null;
  phoneNumber?: string | null;
}) {
  try {
    console.log(`[Sync] Updating profile for user ${userId}...`);
    
    // We use executeRaw to bypass any stale Prisma Client types
    
    if (surname && phoneNumber) {
      await prisma.$executeRaw`
        UPDATE "User" 
        SET "surname" = ${surname}, "phoneNumber" = ${phoneNumber}
        WHERE "id" = ${userId}
      `;
    } else if (surname) {
      await prisma.$executeRaw`
        UPDATE "User" 
        SET "surname" = ${surname}
        WHERE "id" = ${userId}
      `;
    } else if (phoneNumber) {
      await prisma.$executeRaw`
        UPDATE "User" 
        SET "phoneNumber" = ${phoneNumber}
        WHERE "id" = ${userId}
      `;
    }

    console.log(`[Sync] Profile updated successfully for ${userId}`);
    return { success: true };
  } catch (error) {
    console.error("[Sync] Failed to sync user profile via Raw SQL:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Checks if a user with the given phone number exists in the database.
 */
export async function checkUserExistsByPhone(phoneNumber: string) {
  if (!phoneNumber) return { exists: false };
  
  try {
    const user = await prisma.user.findFirst({
      where: {
        phoneNumber: phoneNumber
      },
      select: { id: true }
    });
    
    return { exists: !!user };
  } catch (error) {
    console.error("[Auth] Failed to check user existence by phone:", error);
    return { exists: false, error: String(error) };
  }
}
