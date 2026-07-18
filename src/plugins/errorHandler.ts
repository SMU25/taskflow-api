import type { FastifyInstance } from 'fastify';

import { AppError } from '../lib/errors.js';

interface HttpishError {
  statusCode?: number;
  code?: string;
  validation?: unknown;
  message?: string;
}

// Type guard: звужує unknown → об'єкт, з яким можна працювати, без `as` у самому хендлері
function asHttpishError(error: unknown): HttpishError {
  if (typeof error === 'object' && error !== null) {
    return error as HttpishError;
  }

  return {};
}

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    // 1) Наші доменні помилки
    if (error instanceof AppError) {
      return reply
        .status(error.statusCode)
        .send({ error: { code: error.code, message: error.message } });
    }

    const err = asHttpishError(error);

    // 2) Помилки валідації (Zod через fastify-type-provider-zod)
    if (err.validation || err.code === 'FST_ERR_VALIDATION') {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: err.validation ?? err.message,
        },
      });
    }

    // 3) Інші очікувані клієнтські помилки (напр. @fastify/jwt кидає 401)
    if (typeof err.statusCode === 'number' && err.statusCode < 500) {
      return reply.status(err.statusCode).send({
        error: { code: err.code ?? 'ERROR', message: err.message ?? 'Error' },
      });
    }

    // 4) Усе інше = справжній серверний збій. Логуємо повністю, назовні — нічого зайвого.
    request.log.error({ err: error }, 'Unhandled error');
    return reply.status(500).send({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Something went wrong',
      },
    });
  });
}
