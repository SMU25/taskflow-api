import { z } from 'zod';
import type { Prisma } from '../../prisma/client';

/////////////////////////////////////////
// HELPER FUNCTIONS
/////////////////////////////////////////


/////////////////////////////////////////
// ENUMS
/////////////////////////////////////////

export const TransactionIsolationLevelSchema = z.enum(['ReadUncommitted','ReadCommitted','RepeatableRead','Serializable']);

export const ProjectScalarFieldEnumSchema = z.enum(['id','name','createdAt','updatedAt','deletedAt','workspaceId']);

export const TaskScalarFieldEnumSchema = z.enum(['id','title','description','status','dueDate','createdAt','updatedAt','deletedAt','userId','projectId']);

export const UserScalarFieldEnumSchema = z.enum(['id','email','password','createdAt']);

export const WorkspaceScalarFieldEnumSchema = z.enum(['id','name','slug','createdAt','updatedAt','deletedAt']);

export const MembershipScalarFieldEnumSchema = z.enum(['id','role','createdAt','updatedAt','userId','workspaceId']);

export const SortOrderSchema = z.enum(['asc','desc']);

export const QueryModeSchema = z.enum(['default','insensitive']);

export const NullsOrderSchema = z.enum(['first','last']);

export const TaskStatusSchema = z.enum(['pending','in_progress','completed']);

export type TaskStatusType = `${z.infer<typeof TaskStatusSchema>}`

export const RoleSchema = z.enum(['ADMIN','OWNER','MANAGER','MEMBER']);

export type RoleType = `${z.infer<typeof RoleSchema>}`

/////////////////////////////////////////
// MODELS
/////////////////////////////////////////

/////////////////////////////////////////
// PROJECT SCHEMA
/////////////////////////////////////////

export const ProjectSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  deletedAt: z.coerce.date().nullable(),
  workspaceId: z.string(),
})

export type Project = z.infer<typeof ProjectSchema>

/////////////////////////////////////////
// TASK SCHEMA
/////////////////////////////////////////

export const TaskSchema = z.object({
  status: TaskStatusSchema,
  id: z.uuid(),
  title: z.string().min(1, { message: "Title is required" }),
  description: z.string().nullable(),
  dueDate: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  deletedAt: z.coerce.date().nullable(),
  userId: z.string(),
  projectId: z.string(),
})

export type Task = z.infer<typeof TaskSchema>

/////////////////////////////////////////
// USER SCHEMA
/////////////////////////////////////////

export const UserSchema = z.object({
  id: z.uuid(),
  email: z.email({ message: "Invalid email format" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
  createdAt: z.coerce.date(),
})

export type User = z.infer<typeof UserSchema>

/////////////////////////////////////////
// WORKSPACE SCHEMA
/////////////////////////////////////////

export const WorkspaceSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1, { message: "Workspace name is required" }),
  slug: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  deletedAt: z.coerce.date().nullable(),
})

export type Workspace = z.infer<typeof WorkspaceSchema>

/////////////////////////////////////////
// MEMBERSHIP SCHEMA
/////////////////////////////////////////

export const MembershipSchema = z.object({
  role: RoleSchema,
  id: z.uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  userId: z.string(),
  workspaceId: z.string(),
})

export type Membership = z.infer<typeof MembershipSchema>
