import { z } from 'zod';

import { prisma } from '../src/lib/prisma.js';

const emailSchema = z.email();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true },
  });

  const invalid = users.filter((u) => !emailSchema.safeParse(u.email).success);

  if (invalid.length === 0) {
    console.log('No invalid emails found.');
    return;
  }

  console.log(`Found ${invalid.length} user(s) with invalid email:`);
  invalid.forEach((u) => console.log(`  id=${u.id}  email=${u.email}`));

  const ids = invalid.map((u) => u.id);
  const { count } = await prisma.user.deleteMany({
    where: { id: { in: ids } },
  });

  console.log(`Deleted ${count} user(s).`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
