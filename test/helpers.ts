import { buildApp } from '../src/app';
import type { Role } from '../src/generated/prisma/enums';

// Один інстанс на тест-файл. `inject` сам викликає `ready()`.
export const app = buildApp();

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

/**
 * Запит через увесь стек (authenticate → валідація → гвардія → сервіс → БД)
 * без HTTP-порту. `api(user)` — від імені юзера, `api()` — анонімно.
 */
export function api(user?: { token: string }) {
  const call = (method: Method) => (url: string, payload?: object) =>
    app.inject({
      method,
      url,
      headers: user ? { authorization: `Bearer ${user.token}` } : {},
      ...(payload === undefined ? {} : { payload }),
    });

  return {
    get: call('GET'),
    post: call('POST'),
    patch: call('PATCH'),
    delete: call('DELETE'),
  };
}

export interface TestUser {
  id: string;
  email: string;
  token: string;
}

/** Реєстрація + логін. Кидає з тілом відповіді, якщо щось не 2xx — щоб бачити причину. */
export async function signUp(email: string): Promise<TestUser> {
  const password = 'password123';

  const register = await api().post('/api/auth/register', { email, password });
  ensure(register.statusCode === 201, register);

  const login = await api().post('/api/auth/login', { email, password });
  ensure(login.statusCode === 200, login);

  const { token, user } = login.json<{ token: string; user: { id: string } }>();

  return { id: user.id, email, token };
}

export interface TestWorkspace {
  id: string;
  name: string;
  members: { id: string; userId: string; role: Role }[];
}

export async function createWorkspace(owner: TestUser, name = 'Acme') {
  const res = await api(owner).post('/api/workspaces', { name });
  ensure(res.statusCode === 201, res);

  return res.json<TestWorkspace>();
}

export interface TestMember extends TestUser {
  /** id рядка Membership — те, що йде в URL `/members/:memberId`. */
  memberId: string;
}

/** Додає вже зареєстрованого юзера від імені `actor`. */
export async function addMember(
  actor: TestUser,
  workspaceId: string,
  user: TestUser,
  role: Role,
): Promise<TestMember> {
  const res = await api(actor).post(`/api/workspaces/${workspaceId}/members`, {
    email: user.email,
    role,
  });
  ensure(res.statusCode === 201, res);

  return { ...user, memberId: res.json<{ id: string }>().id };
}

export async function createProject(
  actor: TestUser,
  workspaceId: string,
  name = 'Website',
) {
  const res = await api(actor).post(`/api/workspaces/${workspaceId}/projects`, {
    name,
  });
  ensure(res.statusCode === 201, res);

  return res.json<{ id: string; name: string; workspaceId: string }>();
}

/**
 * Типовий воркспейс: по одному юзеру на кожну роль + сторонній.
 * Більшість тестів RBAC стартують звідси.
 */
export async function seedWorkspace(prefix = 'a') {
  const owner = await signUp(`${prefix}-owner@test.dev`);
  const workspace = await createWorkspace(owner, `Workspace ${prefix}`);

  const ownerMembership = workspace.members.find((m) => m.userId === owner.id);
  ensure(ownerMembership !== undefined, 'creator has no membership');

  const join = async (role: Role) =>
    addMember(
      owner,
      workspace.id,
      await signUp(`${prefix}-${role.toLowerCase()}@test.dev`),
      role,
    );

  return {
    workspace,
    owner: { ...owner, memberId: ownerMembership.id },
    admin: await join('ADMIN'),
    manager: await join('MANAGER'),
    member: await join('MEMBER'),
    outsider: await signUp(`${prefix}-outsider@test.dev`),
  };
}

function ensure(
  condition: boolean,
  context: { statusCode: number; body: string } | string,
): asserts condition {
  if (condition) return;

  const details =
    typeof context === 'string'
      ? context
      : `${context.statusCode} ${context.body}`;
  throw new Error(`Test fixture failed: ${details}`);
}
