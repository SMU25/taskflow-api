# Фаза 1 — Рефактор у шари (route → service → repository)

> **Мета:** винести бізнес-логіку з роутів у `service` + `repository`, додати типові помилки, централізований error-handler, валідацію env і `buildApp()` для тестів.
> **Важливо:** це **refactor без зміни поведінки**. Жодних нових фіч. Ті самі ендпоінти працюють так само — змінюється лише *структура* і *формат помилок*.
> Працюй у гілці: `git checkout -b phase-1/layering`.

---

## Навіщо це (1 абзац для співбесіди)

Зараз логіка живе прямо в роутах: `tasks.routes.ts` сам ходить у Prisma, сам ловить помилки, сам формує відповідь. Це означає: (1) логіку **неможливо протестувати** без підняття HTTP-сервера; (2) кожен роут дублює `try/catch` з generic-повідомленнями; (3) коли в Таску 2 ми міняємо Prisma на Mongoose — доведеться переписувати **роути**. Після Фази 1 бізнес-логіка не знає про Fastify, а БД-доступ ізольований у `repository` — саме той шар, який ми перепишемо під Mongo, не чіпаючи services.

---

## Before → After

```
ЗАРАЗ:                          ПІСЛЯ ФАЗИ 1:
route                            route        (тонкий: схема + виклик service + HTTP-статус)
  └─ prisma + try/catch            └─ service (бізнес-логіка, кидає типові помилки; НЕ знає req/reply)
                                        └─ repository (єдине місце з Prisma)
                                 + setErrorHandler (1 місце ловить усі помилки → єдиний конверт)
                                 + config/env.ts (fail-fast на старті)
                                 + app.ts (buildApp для тестів) / server.ts (listen + graceful shutdown)
```

---

## Цільові файли

```
src/
  config/
    env.ts                 # NEW — Zod-валідація process.env
  lib/
    errors.ts              # NEW — AppError + підкласи
    prisma.ts              # ЗМІНА — бере DATABASE_URL з env
  plugins/
    auth.ts                # NEW — decorate fastify.authenticate (винесли з server.ts)
    errorHandler.ts        # NEW — setErrorHandler
  schemas/
    common.schemas.ts      # NEW — спільна errorResponseSchema (конверт)
  app.ts                   # NEW — buildApp(): збирає Fastify без listen
  server.ts                # ЗМІНА — лише listen + graceful shutdown
  modules/
    auth/
      auth.repository.ts   # NEW
      auth.service.ts      # NEW
      auth.routes.ts       # ЗМІНА — тонкий
      auth.schemas.ts      # ЗМІНА — бере errorResponseSchema зі спільної
    tasks/
      tasks.repository.ts  # NEW
      tasks.service.ts     # NEW
      tasks.routes.ts      # ЗМІНА — тонкий
      tasks.schemas.ts     # ЗМІНА — бере errorResponseSchema зі спільної
```

---

## Крок 0. Валідація env (це був пункт Фази 0 — робимо тут)

### `src/config/env.ts`
```ts
import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url().default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
```

> 🎯 **Що помітити:** сервіс або стартує зі здоровою конфігурацією, або **не стартує взагалі** (fail-fast). Прибрали небезпечний `process.env.JWT_SECRET || 'secret'` — у проді дефолтний секрет = відкриті двері. Тепер `JWT_SECRET` коротший за 16 символів = краш на старті, а не тиха діра в безпеці.

> ⚠️ Перевір, що в `.env` `JWT_SECRET` має ≥16 символів, інакше сервер не підніметься (це навмисно).

---

## Крок 1. Типові помилки

### `src/lib/errors.ts`
```ts
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed') {
    super(400, 'VALIDATION_ERROR', message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(403, 'FORBIDDEN', message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(404, 'NOT_FOUND', message);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super(409, 'CONFLICT', message);
  }
}
```

> 🎯 **Що помітити:** помилка тепер несе *семантику* (`statusCode` + `code`), а не лише текст. Сервіс кидає `new NotFoundError()` — і йому байдуже, що це HTTP 404. Перетворення в HTTP — робота одного місця (error-handler), а не кожного роута.

---

## Крок 2. Єдиний конверт помилки + error-handler

### `src/schemas/common.schemas.ts`
```ts
import { z } from 'zod';

export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
```

### `src/plugins/errorHandler.ts`
```ts
import type { FastifyInstance } from 'fastify';

import { AppError } from '../lib/errors.js';

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    // 1) Наші доменні помилки
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message },
      });
    }

    // 2) Помилки валідації (Zod через fastify-type-provider-zod)
    if (error.validation || error.code === 'FST_ERR_VALIDATION') {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: error.validation ?? error.message,
        },
      });
    }

    // 3) Інші очікувані клієнтські помилки (напр. @fastify/jwt кидає 401)
    if (typeof error.statusCode === 'number' && error.statusCode < 500) {
      return reply.status(error.statusCode).send({
        error: { code: error.code ?? 'ERROR', message: error.message },
      });
    }

    // 4) Усе інше = справжній серверний збій. Логуємо повністю, назовні — нічого зайвого.
    request.log.error({ err: error }, 'Unhandled error');
    return reply.status(500).send({
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Something went wrong' },
    });
  });
}
```

> 🎯 **Що помітити:** stack trace і деталі — лише в логах (`request.log.error`), у відповідь клієнту — безпечний generic. Це OWASP-гігієна: не зливай внутрішню кухню. І жодного `reply.send(err)` (як було в старому `authenticate`) — це якраз зливало деталі.

---

## Крок 3. Tasks: repository → service → routes

### `src/modules/tasks/tasks.repository.ts`
```ts
import { prisma } from '../../lib/prisma.js';

// Єдине місце, що говорить з БД про задачі.
// У Таску 2 цей файл перепишемо на Mongoose — service не зміниться.
export const tasksRepository = {
  listByUser: (userId: string) =>
    prisma.task.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    }),

  create: (data: {
    title: string;
    description: string | null;
    dueDate: Date | null;
    userId: string;
  }) => prisma.task.create({ data }),

  updateOwned: (
    id: string,
    userId: string,
    data: {
      title?: string;
      description?: string | null;
      status?: 'pending' | 'in_progress' | 'completed'; // або $Enums.TaskStatus із generated
    },
  ) => prisma.task.updateMany({ where: { id, userId }, data }),

  deleteOwned: (id: string, userId: string) =>
    prisma.task.deleteMany({ where: { id, userId } }),
};
```

### `src/modules/tasks/tasks.service.ts`
```ts
import { NotFoundError } from '../../lib/errors.js';
import { tasksRepository } from './tasks.repository.js';
import type { CreateTaskBody, UpdateTaskBody } from './tasks.schemas.js';

export const tasksService = {
  list: (userId: string) => tasksRepository.listByUser(userId),

  create: (userId: string, input: CreateTaskBody) =>
    tasksRepository.create({
      title: input.title,
      description: input.description ?? null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      userId,
    }),

  async update(userId: string, id: string, input: UpdateTaskBody) {
    const result = await tasksRepository.updateOwned(id, userId, {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && { description: input.description ?? null }),
      ...(input.status !== undefined && { status: input.status }),
    });

    // count === 0 → таски нема АБО вона не належить юзеру. В обох випадках 404 (не зливаємо існування чужого ресурсу).
    if (result.count === 0) throw new NotFoundError('Task not found');
    return { message: 'Task updated successfully' };
  },

  async remove(userId: string, id: string) {
    const result = await tasksRepository.deleteOwned(id, userId);
    if (result.count === 0) throw new NotFoundError('Task not found');
  },
};
```

### `src/modules/tasks/tasks.routes.ts` (тонкий)
```ts
import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { errorResponseSchema } from '../../schemas/common.schemas.js';
import { tasksService } from './tasks.service.js';
import {
  createTaskBodySchema,
  updateTaskBodySchema,
  taskParamsSchema,
  taskResponseSchema,
  tasksListResponseSchema,
  taskUpdateResponseSchema,
} from './tasks.schemas.js';

export const taskRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.addHook('preHandler', fastify.authenticate);

  app.post(
    '/',
    {
      schema: {
        tags: ['Tasks'],
        summary: 'Create a new task',
        security: [{ bearerAuth: [] }],
        body: createTaskBodySchema,
        response: { 201: taskResponseSchema, 400: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const task = await tasksService.create(request.user.id, request.body);
      return reply.status(201).send(task);
    },
  );

  app.get(
    '/',
    {
      schema: {
        tags: ['Tasks'],
        summary: 'Get all tasks for the authenticated user',
        security: [{ bearerAuth: [] }],
        response: { 200: tasksListResponseSchema },
      },
    },
    (request) => tasksService.list(request.user.id),
  );

  app.put(
    '/:id',
    {
      schema: {
        tags: ['Tasks'],
        summary: 'Update a task by ID',
        security: [{ bearerAuth: [] }],
        params: taskParamsSchema,
        body: updateTaskBodySchema,
        response: {
          200: taskUpdateResponseSchema,
          404: errorResponseSchema,
          400: errorResponseSchema,
        },
      },
    },
    (request) => tasksService.update(request.user.id, request.params.id, request.body),
  );

  app.delete(
    '/:id',
    {
      schema: {
        tags: ['Tasks'],
        summary: 'Delete a task by ID',
        security: [{ bearerAuth: [] }],
        params: taskParamsSchema,
        response: { 204: z.void(), 404: errorResponseSchema },
      },
    },
    async (request, reply) => {
      await tasksService.remove(request.user.id, request.params.id);
      return reply.status(204).send();
    },
  );
};
```

> 🎯 **Що помітити:** зник `try/catch`. Раніше `catch → 400 'Failed to create task'` **маскував серверні збої під 400** — якщо БД лежить, клієнт бачив «погані дані». Тепер невідома помилка летить в error-handler → чесний 500, а 404 кидає сам сервіс. Роут робить рівно одне: HTTP.

---

## Крок 4. Auth: repository → service → routes

### `src/modules/auth/auth.repository.ts`
```ts
import { prisma } from '../../lib/prisma.js';

export const authRepository = {
  findByEmail: (email: string) => prisma.user.findUnique({ where: { email } }),

  create: (data: { email: string; password: string }) =>
    prisma.user.create({
      data,
      select: { id: true, email: true, createdAt: true },
    }),
};
```

### `src/modules/auth/auth.service.ts`
```ts
import bcrypt from 'bcrypt';

import { ConflictError, UnauthorizedError } from '../../lib/errors.js';
import { authRepository } from './auth.repository.js';
import type { LoginBody, RegisterBody } from './auth.schemas.js';

const BCRYPT_ROUNDS = 10;

export const authService = {
  async register(input: RegisterBody) {
    const hashed = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    try {
      return await authRepository.create({ email: input.email, password: hashed });
    } catch (e) {
      // P2002 = Prisma unique constraint violation (email вже існує)
      if (typeof e === 'object' && e !== null && 'code' in e && e.code === 'P2002') {
        throw new ConflictError('User already exists');
      }
      throw e; // невідоме — нехай летить у 500
    }
  },

  async validateCredentials(input: LoginBody) {
    const user = await authRepository.findByEmail(input.email);
    // Одне й те саме повідомлення на «нема юзера» і «невірний пароль» — щоб не давати enumeration.
    if (!user || !(await bcrypt.compare(input.password, user.password))) {
      throw new UnauthorizedError('Invalid credentials');
    }
    const { password: _pw, ...safeUser } = user;
    return safeUser;
  },
};
```

### `src/modules/auth/auth.routes.ts` (тонкий)
```ts
import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import { UnauthorizedError } from '../../lib/errors.js';
import { errorResponseSchema } from '../../schemas/common.schemas.js';
import { authService } from './auth.service.js';
import {
  loginBodySchema,
  loginResponseSchema,
  logoutResponseSchema,
  registerBodySchema,
  userResponseSchema,
} from './auth.schemas.js';

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.post(
    '/register',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Register a new user',
        body: registerBodySchema,
        response: { 201: userResponseSchema, 409: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const user = await authService.register(request.body);
      return reply.status(201).send(user);
    },
  );

  app.post(
    '/login',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Login and receive JWT token',
        body: loginBodySchema,
        response: { 200: loginResponseSchema, 401: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const user = await authService.validateCredentials(request.body);
      // JWT-підпис — інфраструктура Fastify, лишаємо на межі. У Фазі 4 винесемо в TokenService.
      const token = fastify.jwt.sign({ id: user.id, email: user.email });
      return reply.send({ token, user });
    },
  );

  app.post(
    '/logout',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Auth'],
        summary: 'Logout and invalidate JWT token',
        security: [{ bearerAuth: [] }],
        response: { 200: logoutResponseSchema, 401: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const token = request.headers.authorization?.split(' ')[1];
      if (!token) throw new UnauthorizedError('Token not provided');
      await fastify.redis.set(`blacklist:${token}`, 'true', 'EX', 3600);
      return reply.send({ message: 'Logged out successfully' });
    },
  );
};
```

> 🎯 **Що помітити:** `validateCredentials` повертає юзера або **кидає** `UnauthorizedError` — жодних `reply.status(401)` у роуті. Логіка автентифікації тепер тестується без HTTP. JWT/Redis свідомо лишаються на межі (це Fastify-інфраструктура) — у Фазі 4 ми загорнемо їх у `TokenService` і впровадимо як залежність. Це нормальний поетапний рух, а не недоробка.

---

## Крок 5. Оновити схеми (прибрати локальні errorResponseSchema)

У **`auth.schemas.ts`** і **`tasks.schemas.ts`** видали локальний `errorResponseSchema` і не експортуй його звідти (роути тепер беруть його зі `schemas/common.schemas.js`). Решту схем лиши як є.

Якщо десь іще імпортується старий `errorResponseSchema` з модульних схем — заміни імпорт на `from '../../schemas/common.schemas.js'`.

---

## Крок 6. Винести authenticate у плагін

### `src/plugins/auth.ts`
```ts
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { UnauthorizedError } from '../lib/errors.js';

// Викликаємо НА КОРЕНЕВОМУ інстансі (не через app.register), щоб декоратор був глобальним.
// Через app.register декоратор лишився б у дочірньому контексті (інкапсуляція Fastify)
// і не був би видимий у роутах — для цього був би потрібен fastify-plugin.
export function registerAuth(app: FastifyInstance) {
  app.decorate(
    'authenticate',
    async (request: FastifyRequest, _reply: FastifyReply) => {
      try {
        await request.jwtVerify();
      } catch {
        throw new UnauthorizedError('Invalid or missing token');
      }

      const token = request.headers.authorization?.split(' ')[1];
      if (token) {
        const isBlacklisted = await app.redis.get(`blacklist:${token}`);
        if (isBlacklisted) throw new UnauthorizedError('Token is invalidated');
      }
    },
  );
}
```

> 🎯 **Що помітити (Fastify-специфіка):** плагіни Fastify **інкапсульовані** — те, що задекороване всередині `app.register(...)`, не «протікає» назовні. Тому декоратор, потрібний глобально, ставимо прямо на корінь (`registerAuth(app)`), або обгортаємо в `fastify-plugin`. Старий код декорував на корені — ми зберігаємо цю поведінку, але прибираємо `reply.send(err)` (зливало помилку) на користь кидання `UnauthorizedError`.

---

## Крок 7. buildApp() + тонкий server.ts

### `src/lib/prisma.ts` (зміна — через env)
```ts
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

import { env } from '../config/env.js';

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

export const prisma = new PrismaClient({ adapter });
```

### `src/app.ts` (NEW — збирає інстанс, але НЕ слухає порт)
```ts
import Fastify from 'fastify';

import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import fastifyJwt from '@fastify/jwt';
import fastifyRedis from '@fastify/redis';

import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';

import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';
import { registerAuth } from './plugins/auth.js';
import { registerErrorHandler } from './plugins/errorHandler.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { taskRoutes } from './modules/tasks/tasks.routes.js';

export function buildApp() {
  const app = Fastify({ logger: true });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.register(swagger, {
    openapi: {
      openapi: '3.0.0',
      info: {
        title: 'TaskFlow API',
        description: 'REST API for task management with JWT authentication',
        version: '1.0.0',
      },
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
      tags: [
        { name: 'Auth', description: 'Registration, login, logout' },
        { name: 'Tasks', description: 'CRUD operations for tasks' },
      ],
    },
    transform: jsonSchemaTransform,
  });
  app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list', deepLinking: true },
  });

  app.register(fastifyJwt, { secret: env.JWT_SECRET });
  app.register(fastifyRedis, { url: env.REDIS_URL });

  registerAuth(app);          // декоратор fastify.authenticate (на корінь)
  registerErrorHandler(app);  // setErrorHandler (на корінь)

  app.register(authRoutes, { prefix: '/api/auth' });
  app.register(taskRoutes, { prefix: '/api/tasks' });

  app.get('/ping', { schema: { hide: true } }, async () => ({
    status: 'OK',
    message: 'Server is running!',
  }));

  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });

  return app;
}
```

### `src/server.ts` (зміна — лише запуск + graceful shutdown)
```ts
import { buildApp } from './app.js';
import { env } from './config/env.js';
import { initScheduler } from './lib/cron.js';

const app = buildApp();

async function start() {
  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    app.log.info(`🚀 Server running on port ${env.PORT}`);
    initScheduler();
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Graceful shutdown: дочекатись завершення поточних запитів, закрити з'єднання.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    app.log.info(`${signal} received — shutting down`);
    await app.close(); // спрацює onClose → prisma.$disconnect()
    process.exit(0);
  });
}

start();
```

> 🎯 **Що помітити:** `buildApp()` повертає налаштований інстанс **без** `listen`. Це і є ключ до тестів у Фазі 7: `const app = buildApp(); await app.inject({ method: 'POST', url: '/api/auth/login', ... })` — повний прогін без реального порту й мережі. А `server.ts` тепер відповідає лише за життєвий цикл процесу.

---

## Перевірка (нічого не зламалось)

1. `docker compose up -d postgres redis`
2. `npm run dev` — має піднятись без помилок; `/docs` відкривається.
3. Прогін (Bruno / Swagger / curl), очікувана поведінка **та сама**, що й до рефактора:
   - `POST /api/auth/register` новим email → `201` + юзер без пароля.
   - той самий email ще раз → тепер `409` з `{ error: { code: "CONFLICT", ... } }` (раніше було 400).
   - `POST /api/auth/login` вірні дані → `200 { token, user }`; невірні → `401` конверт.
   - без токена `GET /api/tasks` → `401` конверт (раніше міг текти `err`).
   - CRUD задач під токеном працює; `PUT/DELETE` чужого/неіснуючого id → `404` конверт.
   - криве тіло запиту → `400` з `code: "VALIDATION_ERROR"` + `details`.
4. `npm run lint:fix` — без помилок типів/лінту.

> Зверни увагу: **формат помилок змінився** (тепер `{ error: { code, message } }` замість `{ message }`) — це навмисна частина Фази 1. Якщо в тебе вже є Bruno-тести на старий формат — онови їх.

---

## Чеклист Фази 1

- [ ] `config/env.ts` — Zod-валідація, краш на старті; прибрано `|| 'secret'`.
- [ ] `lib/errors.ts` — AppError + 5 підкласів.
- [ ] `schemas/common.schemas.ts` + `plugins/errorHandler.ts` — єдиний конверт помилки.
- [ ] `tasks`: repository + service + тонкий routes (без try/catch).
- [ ] `auth`: repository + service + тонкий routes; P2002 → 409, невірні креди → 401.
- [ ] `plugins/auth.ts` — authenticate кидає UnauthorizedError (без `reply.send(err)`).
- [ ] `app.ts` (buildApp) + тонкий `server.ts` + graceful shutdown + `prisma.$disconnect` на onClose.
- [ ] Ручна перевірка: усі ендпоінти працюють, помилки в новому конверті.
- [ ] Оновити `CLAUDE.md` проєкту (структура папок змінилась) і змерджити гілку.

---

## Типові граблі

- **ESM `.js` в імпортах.** Усі локальні імпорти — з розширенням `.js` (навіть для `.ts` файлів). Забув → рантайм-помилка «cannot find module».
- **Порядок: env до prisma.** `prisma.ts` імпортує `env` — значить `dotenv` + валідація відпрацюють до першого звернення до БД. Не звертайся до `process.env` напряму більше ніде.
- **decorate vs register.** `registerAuth(app)` / `registerErrorHandler(app)` кличемо як звичайні функції на корені, **не** через `app.register` (інакше декоратор/handler застрягне в дочірньому контексті).
- **Zod v4.** Використовуй `z.url()`, `z.email()` (top-level), а не застарілі `z.string().url()`. Помилки читай через `parsed.error.issues`.
- **`request.user`.** Типізація вже є у `types/fastify.d.ts` (`{ id, email }`) — нічого міняти не треба.

---

## Далі

Після зеленої Фази 1 → **Фаза 2** (мультитенантність + relations): додаємо `Workspace / Membership / Project`, переносимо `Task` під `Project`. Шари вже готові — додавання модуля стане механічним (repository → service → routes).
