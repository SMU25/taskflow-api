import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import {
  createTaskBodySchema,
  updateTaskBodySchema,
  taskParamsSchema,
  taskResponseSchema,
  tasksListResponseSchema,
  taskUpdateResponseSchema,
  errorResponseSchema,
} from './tasks.schemas.js';

// Автоматична валідація через Fastify Type Provider! 🔥
export const taskRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // Усі маршрути нижче потребують авторизації
  app.addHook('preHandler', fastify.authenticate);

  // Створення таски
  app.post(
    '/',
    {
      schema: {
        tags: ['Tasks'],
        summary: 'Create a new task',
        security: [{ bearerAuth: [] }],
        body: createTaskBodySchema,
        response: {
          201: taskResponseSchema,
          400: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      // request.body вже валідований та типізований!
      const { title, description, dueDate } = request.body;

      try {
        const task = await prisma.task.create({
          data: {
            title,
            description: description ?? null,
            dueDate: dueDate ? new Date(dueDate) : null,
            userId: request.user.id,
          },
        });

        return reply.status(201).send(task);
      } catch (e) {
        return reply.status(400).send({ message: 'Failed to create task' });
      }
    }
  );

  // Отримання тасок користувача
  app.get(
    '/',
    {
      schema: {
        tags: ['Tasks'],
        summary: 'Get all tasks for the authenticated user',
        security: [{ bearerAuth: [] }],
        response: {
          200: tasksListResponseSchema,
        },
      },
    },
    async (request) => {
      return prisma.task.findMany({
        where: { userId: request.user.id },
      });
    }
  );

  // Оновлення таски
  app.put(
    '/:id',
    {
      schema: {
        tags: ['Tasks'],
        summary: 'Update a task by ID',
        security: [{ bearerAuth: [] }],
        params: taskParamsSchema,
        body: updateTaskBodySchema,
        response: {
          200: taskUpdateResponseSchema,
          404: errorResponseSchema,
          400: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { status, title, description } = request.body;

      try {
        const updatedTask = await prisma.task.updateMany({
          where: { id, userId: request.user.id },
          data: {
            ...(status !== undefined && { status }),
            ...(title !== undefined && { title }),
            ...(description !== undefined && { description: description ?? null }),
          },
        });

        if (updatedTask.count === 0) {
          return reply.status(404).send({ message: 'Task not found' });
        }

        return { message: 'Task updated successfully' };
      } catch (e) {
        return reply.status(400).send({ message: 'Failed to update task' });
      }
    }
  );

  // Видалення таски
  app.delete(
    '/:id',
    {
      schema: {
        tags: ['Tasks'],
        summary: 'Delete a task by ID',
        security: [{ bearerAuth: [] }],
        params: taskParamsSchema,
        response: {
          204: z.void(),
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const deleted = await prisma.task.deleteMany({
        where: { id, userId: request.user.id },
      });

      if (deleted.count === 0) {
        return reply.status(404).send({ message: 'Task not found' });
      }

      return reply.status(204).send();
    }
  );
};
