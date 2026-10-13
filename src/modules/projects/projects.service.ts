import { NotFoundError } from '../../lib/errors';
import {
  type ProjectsRepository,
  projectsRepository,
} from './projects.repository';
import type { CreateProjectBody, UpdateProjectBody } from './projects.schemas';
import type { ProjectScope, UpdateProjectData } from './projects.types';

export class ProjectsService {
  constructor(private readonly repo: ProjectsRepository) {}

  list(workspaceId: string) {
    return this.repo.listByWorkspace(workspaceId);
  }

  async itemById(scope: ProjectScope) {
    const project = await this.repo.findInWorkspace(scope);

    if (!project) throw new NotFoundError('Project not found');

    return project;
  }

  create(workspaceId: string, data: CreateProjectBody) {
    return this.repo.create({ name: data.name, workspaceId });
  }

  async update(scope: ProjectScope, input: UpdateProjectBody) {
    const data: UpdateProjectData = {};

    if (input.name !== undefined) {
      data.name = input.name;
    }

    return await this.repo.update(scope, data);
  }

  remove(scope: ProjectScope) {
    return this.repo.softDelete(scope);
  }

  permanentlyDelete(scope: ProjectScope) {
    return this.repo.permanentlyDelete(scope);
  }
}

export const projectsService = new ProjectsService(projectsRepository);
