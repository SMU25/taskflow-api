import { nanoid } from 'nanoid';
import slugify from 'slugify';

import { NotFoundError } from '../../lib/errors';
import {
  type WorkspacesRepository,
  workspacesRepository,
} from './workspaces.repository';
import type {
  CreateWorkspaceBody,
  UpdateWorkspaceBody,
} from './workspaces.schemas';
import type { UpdateWorkspaceData } from './workspaces.types';

export class WorkspacesService {
  constructor(private readonly repo: WorkspacesRepository) {}

  list(userId: string) {
    return this.repo.listByMember(userId);
  }

  removedList(userId: string) {
    return this.repo.removedListByMember(userId);
  }

  async itemById(id: string) {
    const workspace = await this.repo.findById(id);

    if (!workspace) throw new NotFoundError('Workspace not found');

    return workspace;
  }

  async create(userId: string, data: CreateWorkspaceBody) {
    const slug = slugify(`${data.name}-${nanoid(6)}`, {
      lower: true,
      strict: true,
    });

    return await this.repo.create(userId, { ...data, slug });
  }

  async update(id: string, input: UpdateWorkspaceBody) {
    const data: UpdateWorkspaceData = {};

    if (input.name !== undefined) {
      data.name = input.name;
    }

    return await this.repo.update(id, data);
  }

  async remove(id: string) {
    const slug = slugify(`deleted-${id}-${nanoid(6)}`, {
      lower: true,
      strict: true,
    });

    await this.repo.softDelete(id, slug);
  }

  async permanentlyDelete(id: string) {
    await this.repo.permanentlyDelete(id);
  }
}

export const workspacesService = new WorkspacesService(workspacesRepository);
