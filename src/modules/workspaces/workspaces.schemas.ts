import z from 'zod';

import {
  MembershipSchema,
  ProjectSchema,
  WorkspaceSchema,
} from '../../generated/zod';

export const createWorkspaceBodySchema = WorkspaceSchema.pick({
  name: true,
});

export const updateWorkspaceBodySchema = WorkspaceSchema.pick({
  name: true,
}).partial();

export const workspaceParamsSchema = z.object({
  id: z.uuid('Invalid workspace ID format'),
});

export const workspaceResponseSchema = WorkspaceSchema.omit({
  deletedAt: true,
}).extend({
  members: z.array(MembershipSchema),
  projects: z.array(ProjectSchema),
});

export const workspacesTrashResponseSchema = WorkspaceSchema.extend({
  members: z.array(MembershipSchema),
  projects: z.array(ProjectSchema),
});

export const workspacesListResponseSchema = z.array(
  workspaceResponseSchema.omit({ members: true, projects: true }),
);
export const workspacesTrashListResponseSchema = z.array(
  workspacesTrashResponseSchema.omit({ members: true, projects: true }),
);
export const workspaceUpdateResponseSchema = z.object({
  message: z.string(),
});

export type CreateWorkspaceBody = z.infer<typeof createWorkspaceBodySchema>;
export type UpdateWorkspaceBody = z.infer<typeof updateWorkspaceBodySchema>;
export type WorkspaceParams = z.infer<typeof workspaceParamsSchema>;
export type WorkspaceResponse = z.infer<typeof workspaceResponseSchema>;
export type WorkspaceTrashResponse = z.infer<
  typeof workspacesTrashResponseSchema
>;
export type WorkspacesListResponse = z.infer<
  typeof workspacesListResponseSchema
>;
export type WorkspacesTrashListResponse = z.infer<
  typeof workspacesTrashListResponseSchema
>;
export type WorkspaceUpdateResponse = z.infer<
  typeof workspaceUpdateResponseSchema
>;
