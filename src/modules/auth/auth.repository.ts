import { Prisma } from '../../generated/prisma/client.js';
import { ConflictError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import type { CreateUserData } from './auth.types.js';

export const authRepository = {
  findByEmail: (email: string) => prisma.user.findUnique({ where: { email } }),

  async create(data: CreateUserData) {
    try {
      return await prisma.user.create({
        data,
        select: { id: true, email: true, createdAt: true },
      });
    } catch (error) {
      // Переклад інфра-помилки → доменну. Сервіс про Prisma не знає.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictError('User already exists');
      }
      throw error;
    }
  },
};
