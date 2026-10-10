import { describe, expect, it } from 'vitest';

import { prisma } from '../src/lib/prisma';
import {
  api,
  createProject,
  createWorkspace,
  seedWorkspace,
  signUp,
} from './helpers';

describe('workspaces', () => {
  it('makes the creator the OWNER', async () => {
    const owner = await signUp('owner@test.dev');

    const workspace = await createWorkspace(owner);

    expect(workspace.members).toEqual([
      expect.objectContaining({ userId: owner.id, role: 'OWNER' }),
    ]);
  });

  it('lists only workspaces I am a member of', async () => {
    const { workspace, member, outsider } = await seedWorkspace();

    const mine = await api(member).get('/api/workspaces');
    const theirs = await api(outsider).get('/api/workspaces');

    expect(mine.json()).toEqual([
      expect.objectContaining({ id: workspace.id }),
    ]);
    expect(theirs.json()).toEqual([]);
  });

  it('hides a workspace from a non-member with 404, not 403', async () => {
    const { workspace, outsider } = await seedWorkspace();

    const res = await api(outsider).get(`/api/workspaces/${workspace.id}`);

    expect(res.statusCode, res.body).toBe(404);
  });

  it('rejects a malformed id with 400', async () => {
    const owner = await signUp('owner@test.dev');

    const res = await api(owner).get('/api/workspaces/not-a-uuid');

    expect(res.statusCode, res.body).toBe(400);
  });

  describe('PATCH — ADMIN and above', () => {
    it.each([
      ['member', 403],
      ['manager', 403],
      ['admin', 200],
      ['owner', 200],
    ] as const)('%s → %i', async (role, status) => {
      const seed = await seedWorkspace();

      const res = await api(seed[role]).patch(
        `/api/workspaces/${seed.workspace.id}`,
        { name: 'Renamed' },
      );

      expect(res.statusCode, res.body).toBe(status);
    });

    it('returns the updated workspace, not a message', async () => {
      const { workspace, admin } = await seedWorkspace();

      const res = await api(admin).patch(`/api/workspaces/${workspace.id}`, {
        name: 'Renamed',
      });

      expect(res.json()).toMatchObject({ id: workspace.id, name: 'Renamed' });
    });
  });

  describe('soft delete', () => {
    it('is OWNER-only', async () => {
      const { workspace, admin } = await seedWorkspace();

      const res = await api(admin).delete(`/api/workspaces/${workspace.id}`);

      expect(res.statusCode, res.body).toBe(403);
    });

    it('moves the workspace to the trash', async () => {
      const { workspace, owner } = await seedWorkspace();

      const res = await api(owner).delete(`/api/workspaces/${workspace.id}`);
      expect(res.statusCode, res.body).toBe(204);

      const gone = await api(owner).get(`/api/workspaces/${workspace.id}`);
      const trash = await api(owner).get('/api/workspaces/trash');

      expect(gone.statusCode).toBe(404);
      expect(trash.json()).toEqual([
        expect.objectContaining({ id: workspace.id }),
      ]);
    });

    it('cascades to projects and tasks with one timestamp', async () => {
      const { workspace, owner } = await seedWorkspace();
      const project = await createProject(owner, workspace.id);
      // Таски через API ще не створюються (Крок 6) — кладемо напряму.
      await prisma.task.create({
        data: { title: 'T', userId: owner.id, projectId: project.id },
      });

      await api(owner).delete(`/api/workspaces/${workspace.id}`);

      const [ws, proj, task] = await Promise.all([
        prisma.workspace.findUniqueOrThrow({ where: { id: workspace.id } }),
        prisma.project.findUniqueOrThrow({ where: { id: project.id } }),
        prisma.task.findFirstOrThrow({ where: { projectId: project.id } }),
      ]);

      expect(ws.deletedAt).not.toBeNull();
      expect(proj.deletedAt).toEqual(ws.deletedAt);
      expect(task.deletedAt).toEqual(ws.deletedAt);
    });

    it('frees the slug for reuse', async () => {
      const { workspace, owner } = await seedWorkspace();
      const before = await prisma.workspace.findUniqueOrThrow({
        where: { id: workspace.id },
      });

      await api(owner).delete(`/api/workspaces/${workspace.id}`);

      const after = await prisma.workspace.findUniqueOrThrow({
        where: { id: workspace.id },
      });
      expect(after.slug).not.toBe(before.slug);
      expect(after.slug).toMatch(/^deleted-/);
    });
  });

  describe('permanent delete', () => {
    it('refuses a workspace that is not in the trash with 409', async () => {
      const { workspace, owner } = await seedWorkspace();

      const res = await api(owner).delete(
        `/api/workspaces/${workspace.id}/permanent`,
      );

      expect(res.statusCode, res.body).toBe(409);
    });

    it('removes a trashed workspace for good', async () => {
      const { workspace, owner } = await seedWorkspace();
      await api(owner).delete(`/api/workspaces/${workspace.id}`);

      const res = await api(owner).delete(
        `/api/workspaces/${workspace.id}/permanent`,
      );

      expect(res.statusCode, res.body).toBe(204);
      expect(
        await prisma.workspace.count({ where: { id: workspace.id } }),
      ).toBe(0);
    });

    it('is OWNER-only even in the trash', async () => {
      const { workspace, owner, admin } = await seedWorkspace();
      await api(owner).delete(`/api/workspaces/${workspace.id}`);

      const res = await api(admin).delete(
        `/api/workspaces/${workspace.id}/permanent`,
      );

      expect(res.statusCode, res.body).toBe(403);
    });
  });
});
