import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Database Connection Test ---');
  try {
    const userCount = await prisma.user.count();
    console.log('✅ Successfully connected to the database!');
    console.log(`Current User Count in DB: ${userCount}`);
  } catch (error: any) {
    console.error('❌ Connection failed!');
    console.error(`Error Code: ${error.code || 'N/A'}`);
    console.error(`Message: ${error.message}`);
    console.log('\n--- Troubleshooting ---');
    if (error.message.includes('Can\'t reach database server')) {
      console.log('Suggestion: Your application is still trying to connect to a cloud Supabase pooler.');
      console.log('If you are using Supabase Local, update your .env to use:');
      console.log('DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();
