import { NotFoundError } from '../../lib/errors';
import {
  type ProjectsRepository,
  projectsRepository,
} from '../projects/projects.repository';
import { type TasksRepository, tasksRepository } from './tasks.repository';
import type { CreateTaskBody, UpdateTaskBody } from './tasks.schemas';
import type { ProjectRef, TaskScope, UpdateTaskData } from './tasks.types';

export class TasksService {
  constructor(
    private readonly repo: TasksRepository,
    private readonly projects: ProjectsRepository,
  ) {}

  list(ref: ProjectRef) {
    return this.repo.listByProject(ref);
  }

  async itemById(scope: TaskScope) {
    const task = await this.repo.findInProject(scope);

    if (!task) {
      throw new NotFoundError('Task not found');
    }

    return task;
  }

  async create(ref: ProjectRef, authorId: string, input: CreateTaskBody) {
    const project = await this.projects.findInWorkspace({
      id: ref.projectId,
      workspaceId: ref.workspaceId,
    });

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    return this.repo.create({
      projectId: ref.projectId,
      userId: authorId,
      description: input.description ?? null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      title: input.title,
    });
  }

  async update(scope: TaskScope, input: UpdateTaskBody) {
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

    if (input.dueDate !== undefined) {
      data.dueDate = input.dueDate ? new Date(input.dueDate) : null;
    }

    return this.repo.update(scope, data);
  }

  remove(scope: TaskScope) {
    return this.repo.softDelete(scope);
  }

  permanentlyDelete(scope: TaskScope) {
    return this.repo.permanentlyDelete(scope);
  }
}

export const tasksService = new TasksService(
  tasksRepository,
  projectsRepository,
);
