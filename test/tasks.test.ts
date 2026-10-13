import { describe, expect, it } from 'vitest';

import { prisma } from '../src/lib/prisma';
import { type TestUser, api, createProject, seedWorkspace } from './helpers';

const tasksUrl = (workspaceId: string, projectId: string, taskId = '') =>
  `/api/workspaces/${workspaceId}/projects/${projectId}/tasks${taskId ? `/${taskId}` : ''}`;

interface TestTask {
  id: string;
  title: string;
  userId: string;
  projectId: string;
}

async function createTask(
  actor: TestUser,
  workspaceId: string,
  projectId: string,
  title = 'Write tests',
) {
  const res = await api(actor).post(tasksUrl(workspaceId, projectId), {
    title,
    description: 'Details',
  });
  expect(res.statusCode, res.body).toBe(201);

  return res.json<TestTask>();
}

/** Воркспейс з одним проєктом і однією таскою від MANAGER. */
async function seedTask() {
  const seed = await seedWorkspace();
  const project = await createProject(seed.manager, seed.workspace.id);
  const task = await createTask(seed.manager, seed.workspace.id, project.id);

  return {
    ...seed,
    project,
    task,
    url: tasksUrl(seed.workspace.id, project.id, task.id),
  };
}

describe('tasks', () => {
  describe('create', () => {
    it('lets a MEMBER create a task and records them as the author', async () => {
      const { workspace, manager, member } = await seedWorkspace();
      const project = await createProject(manager, workspace.id);

      const res = await api(member).post(tasksUrl(workspace.id, project.id), {
        title: 'Ship it',
        description: 'Details',
        dueDate: '2030-01-01T00:00:00.000Z',
      });

      expect(res.statusCode, res.body).toBe(201);
      expect(res.json()).toMatchObject({
        title: 'Ship it',
        status: 'pending',
        userId: member.id,
        projectId: project.id,
        dueDate: '2030-01-01T00:00:00.000Z',
      });
      expect(res.json()).not.toHaveProperty('deletedAt');
    });

    it('accepts a title alone — description and dueDate are optional', async () => {
      const { workspace, manager } = await seedWorkspace();
      const project = await createProject(manager, workspace.id);

      const res = await api(manager).post(tasksUrl(workspace.id, project.id), {
        title: 'Only a title',
      });

      expect(res.statusCode, res.body).toBe(201);
      expect(res.json()).toMatchObject({ description: null, dueDate: null });
    });

    it('rejects an empty title with 400', async () => {
      const { workspace, manager } = await seedWorkspace();
      const project = await createProject(manager, workspace.id);

      const res = await api(manager).post(tasksUrl(workspace.id, project.id), {
        title: '',
        description: null,
      });

      expect(res.statusCode, res.body).toBe(400);
    });

    it('returns 404 for a soft-deleted project', async () => {
      const { workspace, manager } = await seedWorkspace();
      const project = await createProject(manager, workspace.id);
      await api(manager).delete(
        `/api/workspaces/${workspace.id}/projects/${project.id}`,
      );

      const res = await api(manager).post(tasksUrl(workspace.id, project.id), {
        title: 'Ghost',
        description: null,
      });

      expect(res.statusCode, res.body).toBe(404);
      expect(await prisma.task.count()).toBe(0);
    });

    it('is closed to an outsider with 404', async () => {
      const { workspace, manager, outsider } = await seedWorkspace();
      const project = await createProject(manager, workspace.id);

      const res = await api(outsider).post(tasksUrl(workspace.id, project.id), {
        title: 'Intrusion',
        description: null,
      });

      expect(res.statusCode, res.body).toBe(404);
    });
  });

  describe('read', () => {
    it('lists only the tasks of this project', async () => {
      const { workspace, manager, member, project, task } = await seedTask();
      const other = await createProject(manager, workspace.id, 'Other');
      await createTask(manager, workspace.id, other.id, 'Elsewhere');

      const res = await api(member).get(tasksUrl(workspace.id, project.id));

      expect(res.statusCode, res.body).toBe(200);
      expect(res.json()).toEqual([expect.objectContaining({ id: task.id })]);
    });

    it('returns one task by id', async () => {
      const { member, task, url } = await seedTask();

      const res = await api(member).get(url);

      expect(res.statusCode, res.body).toBe(200);
      expect(res.json()).toMatchObject({ id: task.id, title: task.title });
    });

    it('rejects a malformed task id with 400', async () => {
      const { workspace, project, member } = await seedTask();

      const res = await api(member).get(
        tasksUrl(workspace.id, project.id, 'not-a-uuid'),
      );

      expect(res.statusCode, res.body).toBe(400);
    });
  });

  describe('tenant isolation (IDOR)', () => {
    // Рівень 1: таска з проєкту X, але в URL — проєкт Y того ж воркспейсу.
    it('cannot reach a task through another project of the same workspace', async () => {
      const { workspace, manager, task } = await seedTask();
      const other = await createProject(manager, workspace.id, 'Other');
      const url = tasksUrl(workspace.id, other.id, task.id);

      const get = await api(manager).get(url);
      const patch = await api(manager).patch(url, { title: 'Pwned' });
      const del = await api(manager).delete(url);

      expect([get.statusCode, patch.statusCode, del.statusCode]).toEqual([
        404, 404, 404,
      ]);
      const untouched = await prisma.task.findUniqueOrThrow({
        where: { id: task.id },
      });
      expect(untouched).toMatchObject({ title: task.title, deletedAt: null });
    });

    // Рівень 2: я OWNER і в A, і в B — гвардія пускає в обидва.
    // Підставляю проєкт і таску з B у URL воркспейсу A.
    it('cannot reach a task from another workspace', async () => {
      const a = await seedWorkspace('a');
      const b = await seedWorkspace('b');
      const foreignProject = await createProject(b.owner, b.workspace.id);
      const foreign = await createTask(
        b.owner,
        b.workspace.id,
        foreignProject.id,
        'Secret',
      );
      const url = tasksUrl(a.workspace.id, foreignProject.id, foreign.id);

      const get = await api(a.owner).get(url);
      const patch = await api(a.owner).patch(url, { title: 'Pwned' });
      const del = await api(a.owner).delete(url);
      const list = await api(a.owner).get(
        tasksUrl(a.workspace.id, foreignProject.id),
      );
      const create = await api(a.owner).post(
        tasksUrl(a.workspace.id, foreignProject.id),
        { title: 'Planted', description: null },
      );

      expect([get.statusCode, patch.statusCode, del.statusCode]).toEqual([
        404, 404, 404,
      ]);
      expect(list.json()).toEqual([]);
      expect(create.statusCode, create.body).toBe(404);

      const tasks = await prisma.task.findMany();
      expect(tasks).toHaveLength(1);
      expect(tasks[0]).toMatchObject({ title: 'Secret', deletedAt: null });
    });
  });

  describe('update', () => {
    it('lets a MEMBER edit a task someone else created', async () => {
      const { member, manager, url } = await seedTask();

      const res = await api(member).patch(url, {
        title: 'Renamed',
        status: 'completed',
      });

      expect(res.statusCode, res.body).toBe(200);
      // Автор не змінюється від того, хто редагує.
      expect(res.json()).toMatchObject({
        title: 'Renamed',
        status: 'completed',
        userId: manager.id,
      });
    });

    it('sets and then clears the due date with null', async () => {
      const { member, url } = await seedTask();

      const set = await api(member).patch(url, {
        dueDate: '2030-01-01T00:00:00.000Z',
      });
      const cleared = await api(member).patch(url, { dueDate: null });

      expect(set.json()).toMatchObject({ dueDate: '2030-01-01T00:00:00.000Z' });
      expect(cleared.statusCode, cleared.body).toBe(200);
      expect(cleared.json()).toMatchObject({ dueDate: null });
    });

    it('leaves fields that are not sent untouched', async () => {
      const { member, url } = await seedTask();

      const res = await api(member).patch(url, { status: 'in_progress' });

      expect(res.json()).toMatchObject({ description: 'Details' });
    });

    it('rejects an empty title with 400', async () => {
      const { member, url } = await seedTask();

      const res = await api(member).patch(url, { title: '' });

      expect(res.statusCode, res.body).toBe(400);
    });
  });

  describe('soft delete', () => {
    it('lets a MEMBER delete and hides the task', async () => {
      const { workspace, project, member, url } = await seedTask();

      const res = await api(member).delete(url);
      expect(res.statusCode, res.body).toBe(204);

      const one = await api(member).get(url);
      const list = await api(member).get(tasksUrl(workspace.id, project.id));
      expect(one.statusCode).toBe(404);
      expect(list.json()).toEqual([]);
    });

    it('returns 404 on a second delete', async () => {
      const { member, url } = await seedTask();
      await api(member).delete(url);

      const res = await api(member).delete(url);

      expect(res.statusCode, res.body).toBe(404);
    });

    it('hides tasks of a soft-deleted project', async () => {
      const { workspace, project, manager, url } = await seedTask();
      await api(manager).delete(
        `/api/workspaces/${workspace.id}/projects/${project.id}`,
      );

      const res = await api(manager).get(url);

      expect(res.statusCode, res.body).toBe(404);
    });
  });

  describe('permanent delete', () => {
    it('returns 404 for a task that is not in the trash', async () => {
      const { owner, url } = await seedTask();

      const res = await api(owner).delete(`${url}/permanent`);

      expect(res.statusCode, res.body).toBe(404);
    });

    it('is OWNER-only and removes a trashed task', async () => {
      const { owner, admin, task, url } = await seedTask();
      await api(owner).delete(url);

      const byAdmin = await api(admin).delete(`${url}/permanent`);
      const byOwner = await api(owner).delete(`${url}/permanent`);

      expect(byAdmin.statusCode, byAdmin.body).toBe(403);
      expect(byOwner.statusCode, byOwner.body).toBe(204);
      expect(await prisma.task.count({ where: { id: task.id } })).toBe(0);
    });
  });
});
