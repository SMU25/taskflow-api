import { buildApp } from './app.js';
import { env } from './config/env.js';
import { initScheduler } from './lib/cron.js';

const app = buildApp();

async function start() {
  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });

    app.log.info(`🚀 Server running on port ${env.PORT}`);

    initScheduler(app.log); // ← тепер передаємо логер (закриває твій tsc-варнінг)
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    app.log.info(`${signal} received — shutting down`);

    await app.close(); // спрацює onClose → prisma.$disconnect()

    process.exit(0);
  });
}

start();
