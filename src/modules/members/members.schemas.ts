import z from 'zod';

import { MembershipSchema, RoleSchema, UserSchema } from '../../generated/zod';

export const addMemberBodySchema = z.object({
  email: z.email('Invalid email format'),
  role: RoleSchema.default('MEMBER'),
});

export const updateMemberBodySchema = MembershipSchema.pick({
  role: true,
});

export const memberScopeParamsSchema = z.object({
  workspaceId: z.uuid('Invalid workspace ID format'),
});

export const memberParamsSchema = z.object({
  workspaceId: z.uuid('Invalid workspace ID format'),
  memberId: z.uuid('Invalid member ID format'),
});

export const memberResponseSchema = MembershipSchema.extend({
  user: UserSchema.pick({ id: true, email: true }),
});

export const membersListResponseSchema = z.array(memberResponseSchema);

export type AddMemberBody = z.infer<typeof addMemberBodySchema>;
export type UpdateMemberBody = z.infer<typeof updateMemberBodySchema>;
export type MemberScopeParams = z.infer<typeof memberScopeParamsSchema>;
export type MemberParams = z.infer<typeof memberParamsSchema>;
export type MemberResponse = z.infer<typeof memberResponseSchema>;
export type MembersListResponse = z.infer<typeof membersListResponseSchema>;
