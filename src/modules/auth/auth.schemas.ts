import { z } from 'zod';

import { UserSchema } from '../../generated/zod/index.js';

// Request Schemas
export const registerBodySchema = UserSchema.pick({
  email: true,
  password: true,
});

export const loginBodySchema = UserSchema.pick({
  email: true,
  password: true,
});

// Response Schemas
export const userResponseSchema = UserSchema.omit({
  password: true, // Не повертаємо пароль в відповіді
});

export const loginResponseSchema = z.object({
  token: z.string(),
  user: userResponseSchema,
});

export const logoutResponseSchema = z.object({
  message: z.string(),
});

// TypeScript Types
export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
export type UserResponse = z.infer<typeof userResponseSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
