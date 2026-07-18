import { prisma } from '../../lib/prisma.js';
import type { CreateTaskData, UpdateTaskData } from './tasks.types.js';

export const tasksRepository = {
  listByUser: (userId: string) =>
    prisma.task.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),

  create: (data: CreateTaskData) => prisma.task.create({ data }),

  updateOwned: (where: { id: string; userId: string }, data: UpdateTaskData) =>
    prisma.task.updateMany({ where, data }),

  deleteOwned: (where: { id: string; userId: string }) =>
    prisma.task.deleteMany({ where }),
};
