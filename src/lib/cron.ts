import cron from 'node-cron';

import { prisma } from './prisma';

export function initScheduler() {
  cron.schedule('* * * * *', async () => {
    console.log('⏰ Checking for overdue tasks...');
    const now = new Date();

    const overdueTasks = await prisma.task.findMany({
      where: {
        status: 'pending',
        dueDate: { lt: now },
      },
      include: { user: true },
    });

    overdueTasks.forEach((task) => {
      console.warn(
        `🚨 ALERT: Task "${task.title}" for user ${task.user.email} is OVERDUE!`,
      );
    });
  });
}
