import type { Role } from '../generated/prisma/enums';
import { ForbiddenError } from './errors';

// Порядок значень у Prisma-енумі довільний (там ADMIN, OWNER, MANAGER, MEMBER),
// тому ієрархію задаємо явно. `satisfies` — щоб нова роль у схемі підсвітилась тут.
export const ROLE_RANK = {
  OWNER: 4,
  ADMIN: 3,
  MANAGER: 2,
  MEMBER: 1,
} as const satisfies Record<Role, number>;

/** Чи має роль щонайменше рівень `min`. */
export const hasMinRole = (role: Role, min: Role): boolean =>
  ROLE_RANK[role] >= ROLE_RANK[min];

/** Чи стоїть `actor` строго вище за `target`. Рівні один одного не чіпають. */
export const outranks = (actor: Role, target: Role): boolean =>
  ROLE_RANK[actor] > ROLE_RANK[target];

/**
 * Політика керування: чи має `actor` право на дію щодо `target`.
 *
 * Дві незалежні умови, і обидві обовʼязкові:
 *  1. планка — актор узагалі допущений керувати (`minRole`);
 *  2. перевага — актор стоїть строго вище за ціль.
 *
 * `target` — це або роль людини, яку чіпаємо, або роль, яку намагаємось видати.
 * Друге прочитання і дає заборону «підвищити до рівня вище/рівного собі».
 *
 * `minRole` параметром, а не зашитим 'ADMIN': ця сама політика знадобиться
 * проєктам і таскам, де планка інша.
 */
export const assertCanManage = (
  actor: Role,
  target: Role,
  minRole: Role,
): void => {
  if (!hasMinRole(actor, minRole) || !outranks(actor, target)) {
    throw new ForbiddenError('Insufficient permissions');
  }
};
