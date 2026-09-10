import { Prisma, type Role } from '../../generated/prisma/client';
import { ConflictError } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import type { CreateMemberData, MemberScope, UserScope } from './members.types';

const PUBLIC_USER_SELECT = {
  id: true,
  email: true,
} satisfies Prisma.UserSelect;

export class MembersRepository {
  // чи є юзер учасником workspace (member)
  findActor({ userId, workspaceId }: UserScope) {
    return prisma.membership.findFirst({
      where: {
        userId,
        workspaceId,
        workspace: {
          deletedAt: null,
        },
      },
      select: { role: true },
    });
  }

  // чи є member дійсно учасником цього workspace (member): пара id + workspaceId, а не просто id: щоб ADMIN воркспейсу A не підсунув memberId з воркспейсу B
  findInWorkspace({ id, workspaceId }: MemberScope) {
    return prisma.membership.findFirst({
      where: {
        id,
        workspaceId,
      },
      include: {
        user: {
          select: PUBLIC_USER_SELECT,
        },
      },
    });
  }

  findUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: {
        email,
      },
      select: PUBLIC_USER_SELECT,
    });
  }

  listByWorkspace(workspaceId: string) {
    return prisma.membership.findMany({
      where: {
        workspaceId,
      },
      include: {
        user: {
          select: PUBLIC_USER_SELECT,
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(data: CreateMemberData) {
    try {
      return await prisma.membership.create({
        data,
        include: {
          user: {
            select: PUBLIC_USER_SELECT,
          },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictError('Member already exists');
      }
      throw error;
    }
  }

  update({ id, workspaceId }: MemberScope, role: Role) {
    return prisma.membership.update({
      where: {
        id,
        workspaceId,
      },
      data: {
        role,
      },
      include: {
        user: {
          select: PUBLIC_USER_SELECT,
        },
      },
    });
  }

  delete({ id, workspaceId }: MemberScope) {
    return prisma.membership.delete({
      where: {
        id,
        workspaceId,
      },
    });
  }
}

export const membersRepository = new MembersRepository();
