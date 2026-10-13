import type { TaskStatus } from '../../generated/prisma/enums.js';

/** Таску завжди шукаємо разом із проєктом і воркспейсом (IDOR на два рівні). */
export interface TaskScope {
  id: string;
  projectId: string;
  workspaceId: string;
}

/** Проєкт, у якому працюємо: для list і create. */
export interface ProjectRef {
  projectId: string;
  workspaceId: string;
}

export interface CreateTaskData {
  title: string;
  description: string | null;
  dueDate: Date | null;
  projectId: string;
  userId: string; // автор — аудит
}

export interface UpdateTaskData {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  dueDate?: Date | null;
}
