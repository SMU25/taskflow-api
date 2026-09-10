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
import type { UpdateWorkspaceData, WorkspaceScope } from './workspaces.types';

export class WorkspacesService {
  constructor(private readonly repo: WorkspacesRepository) {}

  list(userId: string) {
    return this.repo.listByMember(userId);
  }

  removedList(userId: string) {
    return this.repo.removedListByMember(userId);
  }

  async itemById(params: WorkspaceScope) {
    const item = await this.repo.findForMember(params);

    if (!item) throw new NotFoundError('Workspace not found');

    return item;
  }

  async create(userId: string, data: CreateWorkspaceBody) {
    const slug = slugify(`${data.name}-${nanoid(6)}`, {
      lower: true,
      strict: true,
    });

    return await this.repo.create(userId, { ...data, slug });
  }

  async update(params: WorkspaceScope, input: UpdateWorkspaceBody) {
    const data: UpdateWorkspaceData = {};

    if (input.name !== undefined) {
      data.name = input.name;
    }

    const result = await this.repo.updateForRoles(
      {
        ...params,
        roles: ['OWNER', 'ADMIN'],
      },
      data,
    );
    if (result.count === 0) throw new NotFoundError('Workspace not found');

    return { message: 'Workspace updated successfully' };
  }

  async remove(params: WorkspaceScope) {
    const slug = slugify(`deleted-${params.id}-${nanoid(6)}`, {
      lower: true,
      strict: true,
    });

    const result = await this.repo.softDeleteForRoles(
      {
        ...params,
        roles: ['OWNER'],
      },
      slug,
    );
    if (result.count === 0) throw new NotFoundError('Workspace not found');
  }

  async permanentlyDelete(params: WorkspaceScope) {
    const result = await this.repo.permanentlyDeleteForRoles({
      ...params,
      roles: ['OWNER'],
    });

    if (result.count === 0) throw new NotFoundError('Workspace not found');
  }
}

export const workspacesService = new WorkspacesService(workspacesRepository);
