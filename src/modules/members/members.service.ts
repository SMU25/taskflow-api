import { Role } from '../../generated/prisma/enums';
import { ConflictError, NotFoundError } from '../../lib/errors';
import { assertCanManage } from '../../lib/rbac';
import {
  type MembersRepository,
  membersRepository,
} from './members.repository';
import type { AddMemberBody, UpdateMemberBody } from './members.schemas';
import type { ActorContext } from './members.types';

// Планка на керування складом воркспейсу.
const MANAGE_MIN_ROLE = 'ADMIN' as const;

export class MembersService {
  constructor(private readonly repo: MembersRepository) {}

  async list(workspaceId: string) {
    return this.repo.listByWorkspace(workspaceId);
  }

  async add(actor: ActorContext, data: AddMemberBody) {
    const user = await this.repo.findUserByEmail(data.email);

    if (!user) throw new NotFoundError('User not found');

    // Ціль перевірки — роль, яку видаємо: ADMIN не створить ні ADMIN, ні OWNER.
    assertCanManage(actor.role, data.role, MANAGE_MIN_ROLE);

    // Поля поіменно. `{ ...actor, role }` записав би id актора замість запрошеного,
    // і TS цього не побачив би — форми збігаються.
    return this.repo.create({
      userId: user.id,
      workspaceId: actor.workspaceId,
      role: data.role,
    });
  }

  async update(actor: ActorContext, memberId: string, data: UpdateMemberBody) {
    const member = await this.repo.findInWorkspace({
      id: memberId,
      workspaceId: actor.workspaceId,
    });

    if (!member) throw new NotFoundError('Member not found');

    // Дві незалежні перевірки, і жодну не можна пропустити:
    assertCanManage(actor.role, member.role, MANAGE_MIN_ROLE); // чи можу чіпати цю людину
    assertCanManage(actor.role, data.role, MANAGE_MIN_ROLE); // чи можу видати цю роль

    return this.repo.update(
      { id: memberId, workspaceId: actor.workspaceId },
      data.role,
    );
  }

  // юзер може вийти сам (окрім OWNER) і юзера може кікнути ADMIN+
  async delete(actor: ActorContext, memberId: string) {
    const target = { id: memberId, workspaceId: actor.workspaceId };

    const member = await this.repo.findInWorkspace(target);

    if (!member) throw new NotFoundError('Member not found');

    // Самовихід свідомо обходить планку ADMIN, тому гілка має завершувати метод.
    // Провалитись у загальну перевірку не можна: assertCanManage(MEMBER, MEMBER)
    // хибний двічі, і піти з воркспейсу не змогла б жодна людина нижче ADMIN.
    if (actor.userId === member.userId) {
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
