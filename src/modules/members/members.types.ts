import type { Role } from '../../generated/prisma/enums';

/** Хто питає і в якому воркспейсі. Прилітає з JWT + params. */
export interface UserScope {
  userId: string;
  workspaceId: string;
}

/** Ключ рядка для репозиторію: `id` — це PK членства. */
export interface MemberScope {
  id: string;
  workspaceId: string;
}

/**
 * Словник сервісу: є я (`userId`) і є ціль (`memberId`).
 * Поле зветься `memberId`, а не `id`, бо в одному обʼєкті два ідентифікатори —
 * `id` тут був би двозначним і вимагав би перейменування при деструктуризації.
 */
export interface ManageMemberScope extends UserScope {
  memberId: string;
}

/**
 * Поля перелічені явно, хоч і збігаються з `UserScope`.
 * `extends UserScope` зробив би `{ ...scope, role }` валідним — а це рівно та
 * помилка, коли в членство потрапляє id актора замість запрошеного.
 */
export interface CreateMemberData {
  userId: string;
  workspaceId: string;
  role: Role;
}
