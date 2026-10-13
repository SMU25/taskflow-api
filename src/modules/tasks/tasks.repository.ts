import { Prisma } from '../../generated/prisma/client';
import { NotFoundError } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import type {
  CreateTaskData,
  ProjectRef,
  TaskScope,
  UpdateTaskData,
} from './tasks.types';

export class TasksRepository {
  listByProject({ projectId, workspaceId }: ProjectRef) {
    return prisma.task.findMany({
      where: {
        projectId,
        deletedAt: null,
        project: { workspaceId, deletedAt: null },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  findInProject({ id, projectId, workspaceId }: TaskScope) {
    return prisma.task.findFirst({
      where: {
        id,
        projectId,
        deletedAt: null,
        project: { workspaceId, deletedAt: null },
      },
    });
  }

  create(data: CreateTaskData) {
    return prisma.task.create({
      data,
    });
  }

  async update(
    { id, projectId, workspaceId }: TaskScope,
    data: UpdateTaskData,
  ) {
    try {
      return await prisma.task.update({
        where: {
          id,
          projectId,
          deletedAt: null,
          project: { workspaceId, deletedAt: null },
        },
        data,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundError('Task not found');
      }
      throw error;
    }
  }

  async softDelete({ id, projectId, workspaceId }: TaskScope) {
    try {
      return await prisma.task.update({
        where: {
          id,
          projectId,
          deletedAt: null,
          project: { workspaceId, deletedAt: null },
        },
        data: {
          deletedAt: new Date(),
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundError('Task not found');
      }
      throw error;
    }
  }

  async permanentlyDelete({ id, projectId, workspaceId }: TaskScope) {
    try {
      return await prisma.task.delete({
        where: {
          id,
          projectId,
          deletedAt: { not: null },
          project: { workspaceId },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundError('Task not found in trash');
      }
      throw error;
    }
  }
}

export const tasksRepository = new TasksRepository();
