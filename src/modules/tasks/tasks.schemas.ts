import { z } from 'zod';

import { TaskSchema } from '../../generated/zod/index.js';

export const createTaskBodySchema = TaskSchema.pick({
  title: true,
  description: true,
})
  .partial({ description: true })
  .extend({
    dueDate: z.iso.datetime().optional(),
  });

export const updateTaskBodySchema = TaskSchema.partial()
  .pick({
    title: true,
    description: true,
    status: true,
  })
  .extend({
    dueDate: z.iso.datetime().nullable().optional(),
  });

export const taskParamsScopeSchema = z.object({
  workspaceId: z.uuid('Invalid workspace ID format'),
  projectId: z.uuid('Invalid project ID format'),
});

export const taskParamsSchema = z.object({
  workspaceId: z.uuid('Invalid workspace ID format'),
  projectId: z.uuid('Invalid project ID format'),
  taskId: z.uuid('Invalid task ID format'),
});

export const taskResponseSchema = TaskSchema.omit({ deletedAt: true });

export const tasksListResponseSchema = z.array(taskResponseSchema);

export type CreateTaskBody = z.infer<typeof createTaskBodySchema>;
export type UpdateTaskBody = z.infer<typeof updateTaskBodySchema>;
export type TaskScopeParams = z.infer<typeof taskParamsScopeSchema>;
export type TaskParams = z.infer<typeof taskParamsSchema>;
export type TaskResponse = z.infer<typeof taskResponseSchema>;
export type TasksListResponse = z.infer<typeof tasksListResponseSchema>;
