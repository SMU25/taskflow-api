import { describe, expect, it } from 'vitest';

import { prisma } from '../src/lib/prisma';
import { api, createProject, seedWorkspace } from './helpers';

const projectsUrl = (workspaceId: string, projectId = '') =>
  `/api/workspaces/${workspaceId}/projects${projectId ? `/${projectId}` : ''}`;

describe('projects', () => {
  describe('create', () => {
    it.each([
      ['member', 403],
      ['manager', 201],
      ['admin', 201],
      ['owner', 201],
    ] as const)('%s → %i', async (role, status) => {
      const seed = await seedWorkspace();

      const res = await api(seed[role]).post(projectsUrl(seed.workspace.id), {
        name: 'Website',
      });

      expect(res.statusCode, res.body).toBe(status);
    });

    it('rejects an empty name with 400', async () => {
      const { workspace, manager } = await seedWorkspace();

      const res = await api(manager).post(projectsUrl(workspace.id), {
        name: '',
      });

      expect(res.statusCode, res.body).toBe(400);
    });
  });

  describe('read', () => {
    it('is open to any member', async () => {
      const { workspace, manager, member } = await seedWorkspace();
      const project = await createProject(manager, workspace.id);

      const list = await api(member).get(projectsUrl(workspace.id));
      const one = await api(member).get(projectsUrl(workspace.id, project.id));

      expect(list.json()).toEqual([
        expect.objectContaining({ id: project.id }),
      ]);
      expect(one.statusCode, one.body).toBe(200);
      expect(one.json()).not.toHaveProperty('deletedAt');
    });

    it('is closed to an outsider with 404', async () => {
      const { workspace, manager, outsider } = await seedWorkspace();
      const project = await createProject(manager, workspace.id);

      const res = await api(outsider).get(
        projectsUrl(workspace.id, project.id),
      );

      expect(res.statusCode, res.body).toBe(404);
    });
  });

  describe('tenant isolation (IDOR)', () => {
    // Я OWNER і в A, і в B — гвардія мене пропустить у обидва.
    // Перевіряємо, що проєкт з B не дістати через URL воркспейсу A.
    async function crossTenant() {
      const a = await seedWorkspace('a');
      const b = await seedWorkspace('b');
      const foreign = await createProject(b.owner, b.workspace.id, 'Secret');

      return { a, url: projectsUrl(a.workspace.id, foreign.id), foreign };
    }

    it('cannot read a project from another workspace', async () => {
      const { a, url } = await crossTenant();

      const res = await api(a.owner).get(url);

      expect(res.statusCode, res.body).toBe(404);
    });

    it('cannot rename a project from another workspace', async () => {
      const { a, url, foreign } = await crossTenant();

      const res = await api(a.owner).patch(url, { name: 'Pwned' });

      expect(res.statusCode, res.body).toBe(404);
      const untouched = await prisma.project.findUniqueOrThrow({
        where: { id: foreign.id },
      });
      expect(untouched.name).toBe('Secret');
    });

    it('cannot delete a project from another workspace', async () => {
      const { a, url, foreign } = await crossTenant();

      const res = await api(a.owner).delete(url);

      expect(res.statusCode, res.body).toBe(404);
      const untouched = await prisma.project.findUniqueOrThrow({
        where: { id: foreign.id },
      });
      expect(untouched.deletedAt).toBeNull();
    });
  });

  describe('update', () => {
    it('renames and returns the project', async () => {
      const { workspace, manager } = await seedWorkspace();
      const project = await createProject(manager, workspace.id);

      const res = await api(manager).patch(
        projectsUrl(workspace.id, project.id),
        { name: 'Renamed' },
      );

      expect(res.statusCode, res.body).toBe(200);
      expect(res.json()).toMatchObject({ id: project.id, name: 'Renamed' });
    });

    it('is closed to a MEMBER', async () => {
      const { workspace, manager, member } = await seedWorkspace();
      const project = await createProject(manager, workspace.id);

      const res = await api(member).patch(
        projectsUrl(workspace.id, project.id),
        { name: 'Renamed' },
      );

      expect(res.statusCode, res.body).toBe(403);
    });
  });

  describe('soft delete', () => {
    it('hides the project and cascades only to its own tasks', async () => {
      const { workspace, manager } = await seedWorkspace();
      const doomed = await createProject(manager, workspace.id, 'Doomed');
      const kept = await createProject(manager, workspace.id, 'Kept');
      await prisma.task.createMany({
        data: [
          { title: 'A', userId: manager.id, projectId: doomed.id },
          { title: 'B', userId: manager.id, projectId: kept.id },
        ],
      });

      const res = await api(manager).delete(
        projectsUrl(workspace.id, doomed.id),
      );
      expect(res.statusCode, res.body).toBe(204);

      const one = await api(manager).get(projectsUrl(workspace.id, doomed.id));
      const list = await api(manager).get(projectsUrl(workspace.id));
      expect(one.statusCode).toBe(404);
      expect(list.json()).toEqual([expect.objectContaining({ id: kept.id })]);

      const tasks = await prisma.task.findMany({ orderBy: { title: 'asc' } });
      expect(tasks.map((t) => [t.title, t.deletedAt !== null])).toEqual([
        ['A', true],
        ['B', false],
      ]);
    });

    it('disappears from the workspace view', async () => {
      const { workspace, manager } = await seedWorkspace();
      const project = await createProject(manager, workspace.id);

      await api(manager).delete(projectsUrl(workspace.id, project.id));

      const res = await api(manager).get(`/api/workspaces/${workspace.id}`);
      expect(res.json().projects).toEqual([]);
    });
  });

  describe('permanent delete', () => {
    it('returns 404 for a project that is not in the trash', async () => {
      const { workspace, owner } = await seedWorkspace();
      const project = await createProject(owner, workspace.id);

      const res = await api(owner).delete(
        `${projectsUrl(workspace.id, project.id)}/permanent`,
      );

      expect(res.statusCode, res.body).toBe(404);
    });

    it('is OWNER-only and removes a trashed project', async () => {
      const { workspace, owner, admin } = await seedWorkspace();
      const project = await createProject(owner, workspace.id);
      await api(owner).delete(projectsUrl(workspace.id, project.id));
      const url = `${projectsUrl(workspace.id, project.id)}/permanent`;

      const byAdmin = await api(admin).delete(url);
      const byOwner = await api(owner).delete(url);

      expect(byAdmin.statusCode, byAdmin.body).toBe(403);
      expect(byOwner.statusCode, byOwner.body).toBe(204);
      expect(await prisma.project.count({ where: { id: project.id } })).toBe(0);
    });
  });
});
