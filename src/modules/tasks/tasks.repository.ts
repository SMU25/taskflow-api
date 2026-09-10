import { prisma } from '../../lib/prisma.js';
import type { CreateTaskData, UpdateTaskData } from './tasks.types.js';

export class TasksRepository {
  listByUser(userId: string) {
    return prisma.task.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // TODO(Крок 6): таска створюється тільки всередині проєкту.
  // `never` — бо функція завжди кидає; без цього TS виводить `void`
  // і ламає `reply.send(task)` у роуті.
  create(_data: CreateTaskData): never {
    throw new Error('Tasks require a project — див. Крок 6');
  }

  updateOwned(where: { id: string; userId: string }, data: UpdateTaskData) {
    return prisma.task.updateMany({ where, data });
  }

  deleteOwned(where: { id: string; userId: string }) {
    return prisma.task.deleteMany({ where });
  }
}

export const tasksRepository = new TasksRepository();
