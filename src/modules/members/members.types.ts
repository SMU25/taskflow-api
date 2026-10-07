import type { Role } from '../../generated/prisma/enums';

/** Ключ рядка для репозиторію: `id` — це PK членства. */
export interface MemberScope {
  id: string;
  workspaceId: string;
}

export interface FindActor extends Omit<ActorContext, 'role'> {
  includeDeleted?: boolean;
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

/** Хто виконує дію. Роут збирає з request.user + params + request.membership. */
export interface ActorContext {
  userId: string;
  workspaceId: string;
  role: Role;
}
