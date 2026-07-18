import type { FastifyBaseLogger } from 'fastify';

import cron from 'node-cron';

import { prisma } from './prisma.js';

export function initScheduler(log: FastifyBaseLogger) {
  cron.schedule('* * * * *', async () => {
    log.info('⏰ Checking for overdue tasks...');
    const now = new Date();

    const overdueTasks = await prisma.task.findMany({
      where: { status: 'pending', dueDate: { lt: now } },
      include: { user: true },
    });

    for (const task of overdueTasks) {
      log.warn(
        { taskId: task.id, userEmail: task.user.email },
        `🚨 ALERT: Task ID: ${task.id} ("${task.title}") for user ${task.user.email} is OVERDUE!`,
      );
    }
  });
}
