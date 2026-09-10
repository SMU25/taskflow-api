import { Prisma } from '../../generated/prisma/client';
import { ConflictError } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import type {
  CreateWorkspaceData,
  UpdateWorkspaceData,
  WorkspaceRoleScope,
  WorkspaceScope,
} from './workspaces.types';

export class WorkspacesRepository {
  findForMember({ userId, id }: WorkspaceScope) {
    return prisma.workspace.findFirst({
      where: {
        id,
        deletedAt: null,
        members: { some: { userId } },
      },
      include: {
        members: true,
        projects: { where: { deletedAt: null } },
      },
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
            create: { userId, role: 'OWNER' },
          },
        },
        include: {
          members: true,
          projects: true,
        },
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

  updateForRoles(
    { userId, id, roles }: WorkspaceRoleScope,
    data: UpdateWorkspaceData,
  ) {
    return prisma.workspace.updateMany({
      where: {
        id,
        deletedAt: null,
        members: {
          some: {
            userId,
            role: { in: roles },
          },
        },
      },
      data,
    });
  }

  softDeleteForRoles({ id, userId, roles }: WorkspaceRoleScope, slug: string) {
    return prisma.$transaction(async (tx) => {
      const now = new Date();

      const workspace = await tx.workspace.updateMany({
        where: {
          id,
          deletedAt: null,
          members: {
            some: {
              userId,
              role: { in: roles },
            },
          },
        },
        data: {
          slug,
          deletedAt: now,
        },
      });
      if (workspace.count === 0) return workspace; // прав нема — до каскаду не доходимо

      // Права доведені вище. Знизу вгору: таски → проєкти.
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

      return workspace;
    });
  }

  permanentlyDeleteForRoles({ userId, id, roles }: WorkspaceRoleScope) {
    return prisma.workspace.deleteMany({
      where: {
        id,
        deletedAt: { not: null },
        members: {
          some: {
            userId,
            role: { in: roles },
          },
        },
      },
    });
  }
}

export const workspacesRepository = new WorkspacesRepository();
