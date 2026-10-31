/**
 * Database Seed Runner Infrastructure
 * Coordinates mock data and initial configuration across all four members.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding infrastructure...');

  // Minimum baseline health record for connectivity verification
  const healthCheck = await prisma.systemHealth.create({
    data: {
      status: 'SYSTEM_BOOTSTRAPPED',
      checkedAt: new Date(),
    },
  });

  console.log(`✅ System health seed record created [ID: ${healthCheck.id}]`);
  console.log(
    '💡 Note: Member-specific seeds (Users, Products, Subscriptions) will be run in future phases.'
  );
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
