import { NotFoundError } from '../../lib/errors.js';
import { TasksRepository, tasksRepository } from './tasks.repository.js';
import type { CreateTaskBody, UpdateTaskBody } from './tasks.schemas.js';
import type { UpdateTaskData } from './tasks.types.js';

export class TasksService {
  constructor(private readonly repo: TasksRepository) {}

  list(userId: string) {
    return this.repo.listByUser(userId);
  }

  create(userId: string, input: CreateTaskBody) {
    return this.repo.create({
      title: input.title,
      description: input.description ?? null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      userId,
    });
  }

  async update(userId: string, id: string, input: UpdateTaskBody) {
    const data: UpdateTaskData = {};

    if (input.title !== undefined) {
      data.title = input.title;
    }

    if (input.description !== undefined) {
      data.description = input.description;
    }

    if (input.status !== undefined) {
      data.status = input.status;
    }

    const result = await this.repo.updateOwned({ id, userId }, data);
    if (result.count === 0) throw new NotFoundError('Task not found');
    return { message: 'Task updated successfully' };
  }

  async remove(userId: string, id: string) {
    const result = await this.repo.deleteOwned({ id, userId });
    if (result.count === 0) throw new NotFoundError('Task not found');
  }
}

export const tasksService = new TasksService(tasksRepository);
