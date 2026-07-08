# TaskFlow API — Технічний довідник

Супровід до [`../../PROJECT-PLAN.md`](../../PROJECT-PLAN.md). Тут: цільова структура папок, Prisma-схема, ендпоінти, теорія коротко.

---

## 1. Цільова структура папок

```
src/
  server.ts                 # bootstrap: env → plugins → routes → listen, graceful shutdown
  app.ts                    # buildApp(): збирає Fastify-інстанс (для тестів через app.inject)
  config/
    env.ts                  # Zod-валідація process.env, типований export `env`
  plugins/
    prisma.ts               # decorate fastify.prisma
    redis.ts                # @fastify/redis
    auth.ts                 # decorate fastify.authenticate (preHandler) + fastify.user
    swagger.ts
    errorHandler.ts         # setErrorHandler → єдиний конверт помилки
  lib/
    errors.ts               # AppError, NotFoundError, ForbiddenError, ...
    cache.ts                # helper cache-aside (get/set/invalidate з префіксами)
    jwt.ts                  # sign/verify access+refresh, jti
  modules/
    auth/
      auth.routes.ts        # тонкі роути
      auth.service.ts       # реєстрація, логін, refresh-ротація
      auth.repository.ts    # доступ до User у БД
      auth.schemas.ts       # Zod
    workspaces/
      ...routes/service/repository/schemas
    projects/
    tasks/
    comments/
    labels/
    members/                # керування Membership + ролями
  jobs/
    index.ts                # реєстр cron-джобів
    overdue.job.ts
    digest.job.ts
    cleanup.job.ts
  types/
    fastify.d.ts            # augment FastifyInstance/Request
prisma/
  schema.prisma
  migrations/
bruno/                      # колекція запитів (git-friendly)
tests/
  auth.test.ts
  tasks.test.ts
```

> Модуль = вертикальний зріз (routes → service → repository → schemas). Це й є «feature-based» на бекенді.

---

## 2. Цільова Prisma-схема (орієнтир для Фази 2)

```prisma
model User {
  id          String       @id @default(uuid())
  email       String       @unique
  password    String
  name        String?
  createdAt   DateTime     @default(now())
  memberships Membership[]
  assigned    Task[]       @relation("assignee")
  comments    Comment[]
}

model Workspace {
  id          String       @id @default(uuid())
  name        String
  slug        String       @unique
  createdAt   DateTime     @default(now())
  members     Membership[]
  projects    Project[]
  labels      Label[]
  activity    ActivityLog[]
}

model Membership {
  id          String     @id @default(uuid())
  role        Role       @default(MEMBER)
  userId      String
  workspaceId String
  user        User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  workspace   Workspace  @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  createdAt   DateTime   @default(now())

  @@unique([userId, workspaceId])   // один юзер — одне членство у воркспейсі
  @@index([workspaceId])
}

model Project {
  id          String    @id @default(uuid())
  name        String
  description String?
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  tasks       Task[]
  createdAt   DateTime  @default(now())

  @@index([workspaceId])
}

model Task {
  id          String      @id @default(uuid())
  title       String
  description String?
  status      TaskStatus  @default(todo)
  priority    Priority    @default(medium)
  dueDate     DateTime?
  isOverdue   Boolean     @default(false)   // ставить cron
  projectId   String
  project     Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)
  assigneeId  String?
  assignee    User?       @relation("assignee", fields: [assigneeId], references: [id], onDelete: SetNull)
  comments    Comment[]
  labels      TaskLabel[]
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  @@index([projectId, status])      // composite: фільтр по проєкту + статусу
  @@index([assigneeId])
  @@index([dueDate])                // для cron-запиту overdue
}

model Comment {
  id        String   @id @default(uuid())
  body      String
  taskId    String
  task      Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  authorId  String
  author    User     @relation(fields: [authorId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@index([taskId])
}

model Label {
  id          String      @id @default(uuid())
  name        String
  color       String      @default("#888888")
  workspaceId String
  workspace   Workspace   @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  tasks       TaskLabel[]

  @@unique([workspaceId, name])
}

model TaskLabel {            // явна N—N таблиця Task <-> Label
  taskId  String
  labelId String
  task    Task  @relation(fields: [taskId], references: [id], onDelete: Cascade)
  label   Label @relation(fields: [labelId], references: [id], onDelete: Cascade)

  @@id([taskId, labelId])
  @@index([labelId])
}

model ActivityLog {
  id          String    @id @default(uuid())
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  actorId     String?
  action      String    // "task.created", "member.role_changed", ...
  entityType  String    // "task" | "project" | ...
  entityId    String
  meta        Json?
  createdAt   DateTime  @default(now())

  @@index([workspaceId, createdAt])
}

enum Role        { OWNER ADMIN MEMBER }
enum TaskStatus  { todo in_progress done }
enum Priority    { low medium high }
```

> Зверни увагу на **індекси**: композитний `[projectId, status]` (правило equality→range), `[dueDate]` під cron, FK-індекси. Перевір реальні плани через `EXPLAIN (ANALYZE, BUFFERS)` на списках із сотнями рядків.

---

## 3. Ендпоінти (REST-контракт)

База: `/api/v1`. Конверт успіху `{ data, meta? }`, помилки `{ error: { code, message, details? } }`.

### Auth
| Метод | Шлях | Auth | Опис |
|---|---|---|---|
| POST | `/auth/register` | – | створити акаунт |
| POST | `/auth/login` | – | видати access + set refresh-cookie |
| POST | `/auth/refresh` | cookie | ротація: нова пара, інвалідація старого jti |
| POST | `/auth/logout` | cookie | видалити refresh jti з Redis |
| GET  | `/auth/me` | access | поточний юзер + його воркспейси/ролі |

### Workspaces & Members
| Метод | Шлях | Роль | Опис |
|---|---|---|---|
| GET | `/workspaces` | member | мої воркспейси |
| POST | `/workspaces` | – | створити (creator → OWNER) |
| GET | `/workspaces/:id` | member | деталі (cache-aside) |
| PATCH | `/workspaces/:id` | ADMIN+ | оновити |
| DELETE | `/workspaces/:id` | OWNER | видалити |
| GET | `/workspaces/:id/members` | member | список учасників |
| POST | `/workspaces/:id/members` | ADMIN+ | додати учасника |
| PATCH | `/workspaces/:id/members/:userId` | OWNER | змінити роль |
| DELETE | `/workspaces/:id/members/:userId` | ADMIN+ | прибрати |

### Projects / Tasks / Comments / Labels (усі скоуплені по workspace)
| Метод | Шлях | Роль | Опис |
|---|---|---|---|
| GET | `/workspaces/:wsId/projects` | member | список проєктів |
| POST | `/workspaces/:wsId/projects` | ADMIN+ | створити |
| GET/PATCH/DELETE | `/workspaces/:wsId/projects/:id` | за дією | … |
| GET | `/projects/:projectId/tasks?status=&assignee=&page=&limit=` | member | список (фільтри+пагінація) |
| POST | `/projects/:projectId/tasks` | member | створити |
| GET/PATCH/DELETE | `/tasks/:id` | owner/ADMIN | деталі/зміна (IDOR-чек) |
| POST | `/tasks/:id/labels` / DELETE `/tasks/:id/labels/:labelId` | member | привʼязати/відвʼязати label |
| GET/POST | `/tasks/:id/comments` | member | коментарі |
| GET/POST | `/workspaces/:wsId/labels` | ADMIN+ | лейбли |
| GET | `/workspaces/:wsId/dashboard` | member | агрегати (cache-aside, дорого) |

> Статуси: 200/201/204 на успіх; 400 валідація, 401 неавтентифікований, 403 немає прав, 404 не знайдено/чужий ресурс, 409 конфлікт (унікальність), 429 rate-limit.

---

## 4. Теорія коротко (cheat-sheet)

### 4.1 Access + Refresh
- **Access** — короткий (15m), stateless, підписаний JWT. Кладемо в `Authorization: Bearer`. Payload мінімальний (`sub`, `email`). Скомпрометований — живе недовго.
- **Refresh** — довгий (7d), у **httpOnly+Secure+SameSite=strict cookie** (JS не дістане → менший XSS-ризик). Має `jti`.
- **Rotation:** кожен `/auth/refresh` видає НОВУ пару і **відкликає старий jti**. Якщо прийшов уже використаний jti → ймовірна крадіжка → відкликаємо всі сесії юзера.
- **Чому Redis-allowlist** (`refresh:{userId}:{jti} → 1`, TTL=7d): підпис сам по собі **не можна відкликати**; allowlist дає миттєвий logout/revoke. Logout = `DEL` ключа.
- ❗ Ніколи не клади refresh у localStorage. Ніколи не клади ролі/секрети в декодований payload.

### 4.2 AuthN vs AuthZ + IDOR
- **AuthN** (хто ти) — на межі, у `preHandler` (`fastify.authenticate` перевіряє access).
- **AuthZ** (що тобі можна) — у **service**, на кожну дію. Default deny.
- **IDOR:** завжди перевіряй, що ресурс належить воркспейсу юзера, а не просто «існує». `GET /tasks/:id` має впасти 404/403, якщо таска з чужого воркспейса. Не покладайся на «роут недоступний ззовні».
- RBAC-хелпер: `assertRole(userId, workspaceId, minRole)` → тягне Membership (бажано з кешу) → кидає `ForbiddenError`.

### 4.3 Redis: cache-aside
```
read:
  v = redis.get(key)
  if v: return JSON.parse(v)          // hit
  data = db.query()                   // miss
  redis.set(key, JSON, 'EX', ttl+jitter)
  return data
write (update/delete):
  db.write()
  redis.del(key, ...relatedKeys)      // інвалідація
```
- **TTL обовʼязково.** Джитер до TTL — щоб ключі не протухали всі разом (проти stampede).
- **Інвалідацію продумай ДО кешу.** Питання-маркер: «що робить цей ключ застарілим?».
- Префікси-namespace: `tf:ws:{id}:dashboard`, `tf:project:{id}`. Eviction-policy для кеш-інстансу — `allkeys-lru`.
- **Penetration:** негативне кешування (короткий TTL на «не знайдено»), щоб не довбати БД неіснуючими id.
- **Stampede** на дорогій агрегації: `SET lock NX PX` — лише один перераховує, решта чекає/віддає старе.

### 4.4 Rate limiting
- `@fastify/rate-limit` з Redis-store на `/auth/login` (напр. 5/хв на IP+email) — проти брутфорсу. Віддавай `429` + `Retry-After`.

### 4.5 Cron (node-cron)
- Тримай джоби в реєстрі (`jobs/index.ts`), кожен логуй `start/finish + duration_ms`.
- Запити в джобах — індексовані (`@@index([dueDate])` під overdue).
- ⚠️ На N інстансах джоба спрацює N разів. Рішення для проду: лідер-лок у Redis (`SET cron:lock NX PX`) або окремий worker. Тут 1 інстанс — згадай це як трейд-офф.
- Не блокуй event-loop важкою синхронною роботою в джобі; батч great-запити (`updateMany`).

### 4.6 Логування (pino)
- Структурований JSON (Fastify дає pino з коробки). Логуй на межах: вхід запиту, оброблена помилка.
- Кожен лог несе `req.id` (кореляція). **Ніколи** не логуй паролі, токени, refresh-cookie, PII.
- Рівні: `info` — життєвий цикл; `warn` — оброблена аномалія (401, rate-limit); `error` — збій зі стеком.
- У проді — без stack у HTTP-відповіді (тільки в логах). У відповідь — безпечний `{ error: { code, message } }`.

### 4.7 Помилки як значення
- Ієрархія: `AppError(status, code, message)` → `NotFoundError(404)`, `ValidationError(400)`, `UnauthorizedError(401)`, `ForbiddenError(403)`, `ConflictError(409)`.
- Кидай у service, лови в `setErrorHandler` → мапиш у HTTP + єдиний конверт. Нічого не «ковтай» мовчки.

### 4.8 Транзакції
- Read-modify-write із гонками (зміна ролі, перерахунок) → `prisma.$transaction` (interactive) або `SELECT ... FOR UPDATE`.
- Багатокрокові інваріанти (створити workspace + owner-membership) → одна транзакція, інакше можна лишити «осиротілий» воркспейс.

---

## 5. Корисні команди

```bash
docker compose up -d postgres redis   # підняти інфру
npm run dev                           # API з hot-reload (tsx watch)
npx prisma migrate dev --name <desc>  # нова міграція
npx prisma studio                     # GUI БД
npm test                              # Vitest (після Фази 7)
```

Перевірити SQL, який генерує Prisma (полювання на N+1) — у dev додай у `new PrismaClient({ log: ['query'] })`.
