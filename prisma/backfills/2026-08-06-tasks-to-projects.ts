// applied: dev ✅ / prod ⬜
/**
 * Backfill: Task.userId → Project (крок 1b плану expand→backfill→contract).
 *
 * Кожному юзеру, чиї таски ще не прив'язані до проєкту, створює
 * персональний Workspace + Membership(OWNER) + Project 'Default'
 * і переносить туди його таски.
 *
 * Ідемпотентний: працює лише з тасками, де projectId IS NULL,
 * тому повторний запуск (після падіння посередині) безпечний.
 *
 * Запуск: npx tsx prisma/backfill.ts
 */
import { prisma } from '../../src/lib/prisma';

async function main() {
  const users = await prisma.user.findMany({
    where: { tasks: { some: { projectId: null } } },
    select: { id: true, email: true },
  });

  if (users.length === 0) {
    console.log('✅ Нема чого бекфілити — усі таски вже мають проєкт.');

    return;
  }

  console.log(`Знайдено юзерів для бекфілу: ${users.length}`);

  let movedTasks = 0;

  // Послідовно, не Promise.all: паралельні транзакції вичерпають пул з'єднань.
  for (const user of users) {
    const migrated = await prisma.$transaction(async (tx) => {
      // Nested write: Prisma підставить згенерований workspace.id у members і projects.
      const workspace = await tx.workspace.create({
        data: {
          name: 'Personal',
          slug: `personal-${user.id}`,
          members: { create: { userId: user.id, role: 'OWNER' } },
          projects: { create: { name: 'Default' } },
        },
        include: { projects: { select: { id: true } } },
      });

      const project = workspace.projects[0];

      if (!project) {
        throw new Error(`Project не створився для юзера ${user.id}`);
      }

      const { count } = await tx.task.updateMany({
        where: { userId: user.id, projectId: null },
        data: { projectId: project.id },
      });

      return count;
    });

    movedTasks += migrated;
    console.log(`  ✔ ${user.email} — перенесено тасок: ${migrated}`);
  }

  console.log(`\n✅ Готово. Юзерів: ${users.length}, тасок: ${movedTasks}`);
}

main()
  .catch((error) => {
    console.error('❌ Backfill впав:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
