import { afterAll, beforeEach } from 'vitest';

import { env } from '../src/config/env';
import { prisma } from '../src/lib/prisma';
import { assertTestDatabase } from './assert-test-database';
import { app } from './helpers';

let tables: string | undefined;

// Кожен тест стартує з порожньої бази — інакше результат залежить від порядку тестів.
beforeEach(async () => {
  assertTestDatabase(env.DATABASE_URL);

  tables ??= await listTables();
  if (tables) await prisma.$executeRawUnsafe(`TRUNCATE ${tables} CASCADE`);
});

// Закриває Fastify → onClose → prisma.$disconnect, і з'єднання з Redis.
afterAll(async () => {
  await app.close();
});

async function listTables(): Promise<string> {
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;

  return rows.map((row) => `"public"."${row.tablename}"`).join(', ');
}
