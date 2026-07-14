import type { TaskStatus } from '../../generated/prisma/enums.js';

// interface — для форми об'єкта (за твоїм CLAUDE.md: interface для shape, type для юніонів)
export interface CreateTaskData {
  title: string;
  description: string | null;
  dueDate: Date | null;
  userId: string;
}

export interface UpdateTaskData extends Partial<
  Pick<CreateTaskData, 'title' | 'description'>
> {
  status?: TaskStatus; // TaskStatus — це вже union-type із generated, єдине джерело правди
}
