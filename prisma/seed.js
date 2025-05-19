import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const permissions = [
    'All Access',
    'Client Dashboard',
    'Dashboard',
    'Clients',
    'Inbox',
    'Chat',
    'Teams',
    'Projects',
    'Proposals',
    'Payment',
    'Reports',
  ];

  for (const name of permissions) {
    await prisma.permission.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  console.log('Seeded permissions.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });