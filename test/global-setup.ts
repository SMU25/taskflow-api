import { execSync } from 'node:child_process';
import pg from 'pg';

import { assertTestDatabase } from './assert-test-database';

// Раз на весь прогін: створити тестову базу, якщо її нема, і накотити міграції.
export default async function setup() {
  // Уже підмінена на тестову у vitest.config.ts.
  const url = process.env.DATABASE_URL;
  assertTestDatabase(url);

  await ensureDatabaseExists(url);

  // `deploy`, а не `reset`: накатує лише нові міграції і нічого не стирає.
  // Чистоту між тестами дає TRUNCATE у setup.ts.
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  });
}

async function ensureDatabaseExists(url: string) {
  const name = new URL(url).pathname.slice(1);

  // Підключаємось до службової бази `postgres` — до неіснуючої не можна.
  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';

  const client = new pg.Client({ connectionString: adminUrl.toString() });
  await client.connect();

  try {
    const { rowCount } = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [name],
    );
    if (!rowCount) await client.query(`CREATE DATABASE "${name}"`);
  } finally {
    await client.end();
  }
}
