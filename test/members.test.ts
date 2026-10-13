import { describe, expect, it } from 'vitest';

import { api, seedWorkspace, signUp } from './helpers';

const membersUrl = (workspaceId: string, memberId = '') =>
  `/api/workspaces/${workspaceId}/members${memberId ? `/${memberId}` : ''}`;

describe('members', () => {
  describe('list', () => {
    it('is visible to any member and exposes no password', async () => {
      const { workspace, member } = await seedWorkspace();

      const res = await api(member).get(membersUrl(workspace.id));

      expect(res.statusCode, res.body).toBe(200);
      expect(res.json()).toHaveLength(4);
      expect(res.json()[0].user).toEqual({
        id: expect.any(String),
        email: expect.any(String),
      });
    });
  });

  describe('add', () => {
    it('lets an ADMIN add a MEMBER', async () => {
      const { workspace, admin } = await seedWorkspace();
      const newcomer = await signUp('new@test.dev');

      const res = await api(admin).post(membersUrl(workspace.id), {
        email: newcomer.email,
        role: 'MEMBER',
      });

      expect(res.statusCode, res.body).toBe(201);
      // Перевіряємо, що доданий саме запрошений, а не той, хто додає.
      expect(res.json()).toMatchObject({ userId: newcomer.id, role: 'MEMBER' });
    });

    it('defaults the role to MEMBER', async () => {
      const { workspace, owner } = await seedWorkspace();
      const newcomer = await signUp('new@test.dev');

      const res = await api(owner).post(membersUrl(workspace.id), {
        email: newcomer.email,
      });

      expect(res.json()).toMatchObject({ role: 'MEMBER' });
    });

    it('is closed to a MANAGER', async () => {
      const { workspace, manager } = await seedWorkspace();
      const newcomer = await signUp('new@test.dev');

      const res = await api(manager).post(membersUrl(workspace.id), {
        email: newcomer.email,
      });

      expect(res.statusCode, res.body).toBe(403);
    });

    it.each([
      ['admin', 'ADMIN'],
      ['admin', 'OWNER'],
      ['owner', 'OWNER'],
    ] as const)(
      '%s cannot grant %s (only roles strictly below their own)',
      async (actor, role) => {
        const seed = await seedWorkspace();
        const newcomer = await signUp('new@test.dev');

        const res = await api(seed[actor]).post(membersUrl(seed.workspace.id), {
          email: newcomer.email,
          role,
        });

        expect(res.statusCode, res.body).toBe(403);
      },
    );

    it('returns 404 for an unknown email', async () => {
      const { workspace, owner } = await seedWorkspace();

      const res = await api(owner).post(membersUrl(workspace.id), {
        email: 'ghost@test.dev',
      });

      expect(res.statusCode, res.body).toBe(404);
    });

    it('returns 409 for an existing member', async () => {
      const { workspace, owner, member } = await seedWorkspace();

      const res = await api(owner).post(membersUrl(workspace.id), {
        email: member.email,
      });

      expect(res.statusCode, res.body).toBe(409);
    });
  });

  describe('change role', () => {
    it('lets the OWNER promote a MEMBER to ADMIN', async () => {
      const { workspace, owner, member } = await seedWorkspace();

      const res = await api(owner).patch(
        membersUrl(workspace.id, member.memberId),
        { role: 'ADMIN' },
      );

      expect(res.statusCode, res.body).toBe(200);
      expect(res.json()).toMatchObject({ role: 'ADMIN' });
    });

    it('does not let an ADMIN demote the OWNER', async () => {
      const { workspace, owner, admin } = await seedWorkspace();

      const res = await api(admin).patch(
        membersUrl(workspace.id, owner.memberId),
        { role: 'MEMBER' },
      );

      expect(res.statusCode, res.body).toBe(403);
    });

    it('does not let an ADMIN promote someone to their own rank', async () => {
      const { workspace, admin, member } = await seedWorkspace();

      const res = await api(admin).patch(
        membersUrl(workspace.id, member.memberId),
        { role: 'ADMIN' },
      );

      expect(res.statusCode, res.body).toBe(403);
    });
  });

  describe('remove', () => {
    it('lets a MEMBER leave on their own', async () => {
      const { workspace, member } = await seedWorkspace();

      const res = await api(member).delete(
        membersUrl(workspace.id, member.memberId),
      );
      expect(res.statusCode, res.body).toBe(204);

      const after = await api(member).get(`/api/workspaces/${workspace.id}`);
      expect(after.statusCode).toBe(404);
    });

    it('does not let the OWNER leave', async () => {
      const { workspace, owner } = await seedWorkspace();

      const res = await api(owner).delete(
        membersUrl(workspace.id, owner.memberId),
      );

      expect(res.statusCode, res.body).toBe(409);
    });

    it('does not let a MEMBER kick someone else', async () => {
      const { workspace, member, manager } = await seedWorkspace();

      const res = await api(member).delete(
        membersUrl(workspace.id, manager.memberId),
      );

      expect(res.statusCode, res.body).toBe(403);
    });

    it('does not let an ADMIN kick another ADMIN', async () => {
      const seed = await seedWorkspace();
      const otherAdmin = await signUp('admin2@test.dev');
      const res0 = await api(seed.owner).post(membersUrl(seed.workspace.id), {
        email: otherAdmin.email,
        role: 'ADMIN',
      });
      const otherAdminMemberId = res0.json<{ id: string }>().id;

      const res = await api(seed.admin).delete(
        membersUrl(seed.workspace.id, otherAdminMemberId),
      );

      expect(res.statusCode, res.body).toBe(403);
    });

    it('lets an ADMIN kick a MANAGER', async () => {
      const { workspace, admin, manager } = await seedWorkspace();

      const res = await api(admin).delete(
        membersUrl(workspace.id, manager.memberId),
      );

      expect(res.statusCode, res.body).toBe(204);
    });
  });

  describe('tenant isolation', () => {
    it('refuses a memberId from another workspace (IDOR) with 404', async () => {
      const a = await seedWorkspace('a');
      const b = await seedWorkspace('b');

      // OWNER воркспейсу A підставляє id учасника з B у URL свого воркспейсу.
      const patch = await api(a.owner).patch(
        membersUrl(a.workspace.id, b.member.memberId),
        { role: 'MANAGER' },
      );
      const remove = await api(a.owner).delete(
        membersUrl(a.workspace.id, b.member.memberId),
      );

      expect(patch.statusCode, patch.body).toBe(404);
      expect(remove.statusCode, remove.body).toBe(404);
    });

    it('hides the member list from an outsider', async () => {
      const { workspace, outsider } = await seedWorkspace();

      const res = await api(outsider).get(membersUrl(workspace.id));

      expect(res.statusCode, res.body).toBe(404);
    });
  });
});
