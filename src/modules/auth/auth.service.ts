import bcrypt from 'bcrypt';

import { env } from '../../config/env';
import { UnauthorizedError } from '../../lib/errors.js';
import { AuthRepository, authRepository } from './auth.repository.js';
import type { LoginBody, RegisterBody } from './auth.schemas.js';

// bcrypt навмисно повільний (~50 мс на 10 раундах) — це і є захист від перебору.
// У тестах хешуємо сотні юзерів, тож знижуємо до мінімуму: стійкість там не потрібна.
const BCRYPT_ROUNDS = env.NODE_ENV === 'test' ? 4 : 10;

export class AuthService {
  constructor(private readonly repo: AuthRepository) {}

  async register(input: RegisterBody) {
    const hashed = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

    return this.repo.create({ email: input.email, password: hashed });
  }

  async validateCredentials(input: LoginBody) {
    const user = await this.repo.findByEmail(input.email);

    // Однакове повідомлення на «нема юзера» і «невірний пароль» — проти user enumeration.
    if (!user || !(await bcrypt.compare(input.password, user.password))) {
      throw new UnauthorizedError('Invalid credentials');
    }
    const { password: _pw, ...safeUser } = user;

    return safeUser;
  }
}

export const authService = new AuthService(authRepository);
