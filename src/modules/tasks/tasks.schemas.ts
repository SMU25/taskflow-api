import { z } from 'zod';

import { TaskSchema } from '../../generated/zod/index.js';

// ==========================================
// REQUEST SCHEMAS (базуються на TaskSchema)
// ==========================================

/**
 * Схема для створення таски
 * Використовує .pick() щоб взяти тільки потрібні поля
 * dueDate приймає string (ISO) який перетвориться в Date на сервері
 */
export const createTaskBodySchema = TaskSchema.pick({
  title: true,
  description: true,
}).extend({
  // Перевизначаємо dueDate - в API приймаємо string замість Date
  dueDate: z.string().datetime().optional(),
});

/**
 * Схема для оновлення таски
 * .partial() робить всі поля optional
 * .pick() бере тільки ті поля які можна оновлювати
 */
export const updateTaskBodySchema = TaskSchema.partial().pick({
  title: true,
  description: true,
  status: true,
});

/**
 * Схема для параметрів маршруту (/:id)
 */
export const taskParamsSchema = z.object({
  id: z.uuid('Invalid task ID format'),
});

// ==========================================
// RESPONSE SCHEMAS
// ==========================================

/**
 * Схема відповіді для однієї таски
 * Використовує TaskSchema як є, бо це точна копія DB моделі
 */
export const taskResponseSchema = TaskSchema;

/**
 * Схема відповіді для списку тасок
 */
export const tasksListResponseSchema = z.array(taskResponseSchema);

/**
 * Схема відповіді після оновлення
 */
export const taskUpdateResponseSchema = z.object({
  message: z.string(),
});

// ==========================================
// TYPESCRIPT TYPES (інференція з Zod)
// ==========================================

export type CreateTaskBody = z.infer<typeof createTaskBodySchema>;
export type UpdateTaskBody = z.infer<typeof updateTaskBodySchema>;
export type TaskParams = z.infer<typeof taskParamsSchema>;
export type TaskResponse = z.infer<typeof taskResponseSchema>;
export type TasksListResponse = z.infer<typeof tasksListResponseSchema>;
export type TaskUpdateResponse = z.infer<typeof taskUpdateResponseSchema>;
