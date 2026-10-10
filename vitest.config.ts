import 'dotenv/config';
import { defineConfig } from 'vitest/config';

// Тестова база — той самий сервер, що в .env, але база з суфіксом `_test`.
// Окремого файлу з паролем не заводимо: секрет лишається тільки в .env.
function testDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL is not set — check .env');

  const url = new URL(raw);
  const name = url.pathname.slice(1);
  if (!name.endsWith('_test')) url.pathname = `/${name}_test`;

  return url.toString();
}

const databaseUrl = testDatabaseUrl();

// globalSetup біжить у цьому ж процесі — бачить змінну звідси.
process.env.DATABASE_URL = databaseUrl;

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/global-setup.ts'],
    setupFiles: ['test/setup.ts'],
    // Воркери. dotenv у src/config/env.ts не перезаписує вже встановлені
    // змінні, тож перемагає тестова база.
    env: { NODE_ENV: 'test', DATABASE_URL: databaseUrl },
    // База одна на всіх: паралельні файли стирали б дані один одному.
    fileParallelism: false,
    hookTimeout: 30_000,
  },
});
