import { Prisma } from '../../generated/prisma/client';
import { NotFoundError } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import type {
  CreateProjectData,
  ProjectScope,
  UpdateProjectData,
} from './projects.types';

export class ProjectsRepository {
  listByWorkspace(workspaceId: string) {
    return prisma.project.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  findInWorkspace({ id, workspaceId }: ProjectScope) {
    return prisma.project.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });
  }

  create(data: CreateProjectData) {
    return prisma.project.create({
      data,
    });
  }

  async update({ id, workspaceId }: ProjectScope, data: UpdateProjectData) {
    try {
      return await prisma.project.update({
        where: { id, workspaceId, deletedAt: null },
        data,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundError('Project not found');
      }
      throw error;
    }
  }

  async softDelete({ id, workspaceId }: ProjectScope) {
    try {
      return await prisma.$transaction(async (tx) => {
        const now = new Date();

        await tx.project.update({
          where: {
            id,
            workspaceId,
            deletedAt: null,
          },
          data: {
            deletedAt: now,
          },
        });

        await tx.task.updateMany({
          where: {
            projectId: id,
            deletedAt: null,
          },
          data: { deletedAt: now },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundError('Project not found');
      }
      throw error;
    }
  }

  async permanentlyDelete({ id, workspaceId }: ProjectScope) {
    try {
      return await prisma.project.delete({
        where: {
          id,
          workspaceId,
          deletedAt: { not: null },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        // Гвардія довела лише воркспейс, не проєкт: P2025 тут — і «не в кошику»,
        // і «нема», і «чужий». Тому 404, а не 409, як у воркспейсах.
        throw new NotFoundError('Project not found in trash');
      }
      throw error;
    }
  }
}

export const projectsRepository = new ProjectsRepository();
