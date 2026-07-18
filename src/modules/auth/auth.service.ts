import bcrypt from 'bcrypt';

import { UnauthorizedError } from '../../lib/errors.js';
import { authRepository } from './auth.repository.js';
import type { LoginBody, RegisterBody } from './auth.schemas.js';

const BCRYPT_ROUNDS = 10;

export const authService = {
  async register(input: RegisterBody) {
    const hashed = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

    return authRepository.create({ email: input.email, password: hashed });
  },

  async validateCredentials(input: LoginBody) {
    const user = await authRepository.findByEmail(input.email);

    // Однакове повідомлення на «нема юзера» і «невірний пароль» — проти user enumeration.
    if (!user || !(await bcrypt.compare(input.password, user.password))) {
      throw new UnauthorizedError('Invalid credentials');
    }
    const { password: _pw, ...safeUser } = user;

    return safeUser;
  },
};
