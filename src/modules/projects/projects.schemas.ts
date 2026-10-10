import z from 'zod';

import { ProjectSchema } from '../../generated/zod';

export const createProjectBodySchema = ProjectSchema.pick({
  name: true,
});

export const updateProjectBodySchema = ProjectSchema.pick({
  name: true,
}).partial();

export const projectScopeParamsSchema = z.object({
  workspaceId: z.uuid('Invalid workspace ID format'),
});

export const projectParamsSchema = z.object({
  workspaceId: z.uuid('Invalid workspace ID format'),
  projectId: z.uuid('Invalid project ID format'),
});

export const projectResponseSchema = ProjectSchema.omit({ deletedAt: true });

export const projectsListResponseSchema = z.array(projectResponseSchema);

export type CreateProjectBody = z.infer<typeof createProjectBodySchema>;
export type UpdateProjectBody = z.infer<typeof updateProjectBodySchema>;
export type ProjectScopeParams = z.infer<typeof projectScopeParamsSchema>;
export type ProjectParams = z.infer<typeof projectParamsSchema>;
export type ProjectResponse = z.infer<typeof projectResponseSchema>;
export type ProjectsListResponse = z.infer<typeof projectsListResponseSchema>;
