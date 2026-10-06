import { Prisma, Role } from '../../generated/prisma/client';
import { ConflictError, NotFoundError } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import type {
  CreateWorkspaceData,
  UpdateWorkspaceData,
} from './workspaces.types';

const WORKSPACE_INCLUDE = {
  members: true,
  projects: { where: { deletedAt: null } },
} satisfies Prisma.WorkspaceInclude;

export class WorkspacesRepository {
  findById(id: string) {
    return prisma.workspace.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: WORKSPACE_INCLUDE,
    });
  }

  listByMember(userId: string) {
    return prisma.workspace.findMany({
      where: {
        deletedAt: null,
        members: { some: { userId } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  removedListByMember(userId: string) {
    return prisma.workspace.findMany({
      where: {
        deletedAt: { not: null },
        members: { some: { userId } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, data: CreateWorkspaceData) {
    try {
      return await prisma.workspace.create({
        data: {
          ...data,
          members: {
            create: { userId, role: Role.OWNER },
          },
        },
        include: WORKSPACE_INCLUDE,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictError('Workspace already exists');
      }
      throw error;
    }
  }

  async update(id: string, data: UpdateWorkspaceData) {
    try {
      return await prisma.workspace.update({
        where: {
          id,
          deletedAt: null,
        },
        data,
        include: WORKSPACE_INCLUDE,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundError('Workspace not found');
      }
      throw error;
    }
  }

  async softDelete(id: string, slug: string) {
    try {
      return await prisma.$transaction(async (tx) => {
        const now = new Date();

        await tx.workspace.update({
          where: {
            id,
            deletedAt: null,
          },
          data: {
            slug,
            deletedAt: now,
          },
        });

        await tx.task.updateMany({
          where: {
            deletedAt: null,
            project: { workspaceId: id },
          },
          data: { deletedAt: now },
        });

        await tx.project.updateMany({
          where: {
            deletedAt: null,
            workspaceId: id,
          },
          data: { deletedAt: now },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundError('Workspace not found');
      }
      throw error;
    }
  }

  async permanentlyDelete(id: string) {
    try {
      return await prisma.workspace.delete({
        where: {
          id,
          deletedAt: { not: null },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new ConflictError('Workspace is not in trash');
      }
      throw error;
    }
  }
}

export const workspacesRepository = new WorkspacesRepository();
