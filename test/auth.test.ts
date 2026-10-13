import { describe, expect, it } from 'vitest';

import { api, signUp } from './helpers';

describe('auth', () => {
  it('rejects a protected route without a token', async () => {
    const res = await api().get('/api/workspaces');

    expect(res.statusCode, res.body).toBe(401);
  });

  it('rejects a forged token', async () => {
    const res = await api({ token: 'not.a.jwt' }).get('/api/workspaces');

    expect(res.statusCode, res.body).toBe(401);
  });

  it('rejects a token after logout', async () => {
    const user = await signUp('user@test.dev');

    const logout = await api(user).post('/api/auth/logout');
    expect(logout.statusCode, logout.body).toBe(200);

    const res = await api(user).get('/api/workspaces');
    expect(res.statusCode, res.body).toBe(401);
  });

  it('rejects a duplicate email', async () => {
    await signUp('user@test.dev');

    const res = await api().post('/api/auth/register', {
      email: 'user@test.dev',
      password: 'password123',
    });

    expect(res.statusCode, res.body).toBe(409);
  });

  it('never returns the password hash', async () => {
    const res = await api().post('/api/auth/register', {
      email: 'user@test.dev',
      password: 'password123',
    });

    expect(res.json()).not.toHaveProperty('password');
  });
});
