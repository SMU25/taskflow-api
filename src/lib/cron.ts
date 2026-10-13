import type { FastifyBaseLogger } from 'fastify';

import cron from 'node-cron';

import { prisma } from './prisma.js';

export function initScheduler(log: FastifyBaseLogger) {
  cron.schedule('* * * * *', async () => {
    log.info('⏰ Checking for overdue tasks...');
    const now = new Date();

    const overdueTasks = await prisma.task.findMany({
      where: {
        status: 'pending',
        dueDate: { lt: now },
        deletedAt: null,
        project: { deletedAt: null },
      },
      select: {
        id: true,
        title: true,
        userId: true,
      },
    });

    for (const task of overdueTasks) {
      log.warn(
        { taskId: task.id, userId: task.userId },
        `🚨 ALERT: Task ID: ${task.id} ("${task.title}") for user ${task.userId} is OVERDUE!`,
      );
    }
  });
}
