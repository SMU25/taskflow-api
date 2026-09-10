import { Role } from '../../generated/prisma/enums';
import { ConflictError, NotFoundError } from '../../lib/errors';
import { assertCanManage } from '../../lib/rbac';
import {
  type MembersRepository,
  membersRepository,
} from './members.repository';
import type { AddMemberBody, UpdateMemberBody } from './members.schemas';
import type { ManageMemberScope, UserScope } from './members.types';

// Планка на керування складом воркспейсу.
const MANAGE_MIN_ROLE = 'ADMIN' as const;

export class MembersService {
  constructor(private readonly repo: MembersRepository) {}

  // Кожен метод відкривається однаково: дістати своє членство і впасти 404,
  // якщо його нема. 404, а не 403 — не член не має дізнатись, що воркспейс існує.
  // Дублювання свідоме: на Кроці 4 ці два рядки заберає requireMembership.

  async list(scope: UserScope) {
    const actor = await this.repo.findActor(scope);
    if (!actor) throw new NotFoundError('Workspace not found');

    // Право доведене вище — далі запит уже без userId, інакше вернеться лише моє членство.
    return this.repo.listByWorkspace(scope.workspaceId);
  }

  async add(scope: UserScope, data: AddMemberBody) {
    // Запити незалежні — один похід замість двох послідовних.
    const [actor, user] = await Promise.all([
      this.repo.findActor(scope),
      this.repo.findUserByEmail(data.email),
    ]);

    if (!actor) throw new NotFoundError('Workspace not found');
    if (!user) throw new NotFoundError('User not found');

    // Ціль перевірки — роль, яку видаємо: ADMIN не створить ні ADMIN, ні OWNER.
    assertCanManage(actor.role, data.role, MANAGE_MIN_ROLE);

    // Поля поіменно. `{ ...scope, role }` записав би id актора замість запрошеного,
    // і TS цього не побачив би — форми збігаються.
    return this.repo.create({
      userId: user.id,
      workspaceId: scope.workspaceId,
      role: data.role,
    });
  }

  async update(scope: ManageMemberScope, data: UpdateMemberBody) {
    const [actor, member] = await Promise.all([
      this.repo.findActor(scope),
      this.repo.findInWorkspace({
        id: scope.memberId,
        workspaceId: scope.workspaceId,
      }),
    ]);

    if (!actor) throw new NotFoundError('Workspace not found');
    if (!member) throw new NotFoundError('Member not found');

    // Дві незалежні перевірки, і жодну не можна пропустити:
    assertCanManage(actor.role, member.role, MANAGE_MIN_ROLE); // чи можу чіпати цю людину
    assertCanManage(actor.role, data.role, MANAGE_MIN_ROLE); // чи можу видати цю роль

    return this.repo.update(
      { id: scope.memberId, workspaceId: scope.workspaceId },
      data.role,
    );
  }

  async delete(scope: ManageMemberScope) {
    const [actor, member] = await Promise.all([
      this.repo.findActor(scope),
      this.repo.findInWorkspace({
        id: scope.memberId,
        workspaceId: scope.workspaceId,
      }),
    ]);

    if (!actor) throw new NotFoundError('Workspace not found');
    if (!member) throw new NotFoundError('Member not found');

    const target = { id: scope.memberId, workspaceId: scope.workspaceId };

    // Самовихід свідомо обходить планку ADMIN, тому гілка має завершувати метод.
    // Провалитись у загальну перевірку не можна: assertCanManage(MEMBER, MEMBER)
    // хибний двічі, і піти з воркспейсу не змогла б жодна людина нижче ADMIN.
    if (member.userId === scope.userId) {
      // Єдине місце, де захист останнього OWNER реально спрацьовує: ззовні
      // OWNER'а ніхто не дістане, бо над ним нема рангу.
      if (actor.role === Role.OWNER) {
        throw new ConflictError('Transfer ownership first');
      }

      return this.repo.delete(target);
    }

    assertCanManage(actor.role, member.role, MANAGE_MIN_ROLE);

    return this.repo.delete(target);
  }
}

export const membersService = new MembersService(membersRepository);
