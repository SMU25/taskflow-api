# TaskFlow API — AGENTS.md

Guidelines for AI coding agents working in this repository.

## Must-Read Before Any Change

- Read `CLAUDE.md` for full project context (stack, structure, conventions).
- Read the relevant `*.schemas.ts` before touching a route file.
- Run `npm run lint:fix` after edits — ESLint + Prettier are enforced.

## Code Style Rules

### TypeScript / ESM
- All local imports **must** end in `.js` (ESM resolution): `import { prisma } from '../../lib/prisma.js'`.
- Project uses `"type": "module"` — no CommonJS `require()`.
- Target is TypeScript 6; use modern syntax freely.

### Validation
- Every route **must** declare Zod schemas for `body`, `params`, `response` in `schema: {}`.
- Define schemas in the module's `*.schemas.ts`, not inline in routes.
- Never manually check `request.body` fields — Zod + type provider handles it.
- Use `fastify.withTypeProvider<ZodTypeProvider>()` inside every plugin to get typed request objects.

### Auth
- Protected routes: add `preHandler: [fastify.authenticate]` to individual routes, or `app.addHook('preHandler', fastify.authenticate)` once for the whole plugin.
- `request.user` is typed via `src/types/fastify.d.ts` — always scope DB queries with `userId: request.user.id`.

### Database
- Import Prisma client only from `src/lib/prisma.ts`.
- Always scope task queries with `userId: request.user.id` — never expose cross-user data.
- After schema changes: run `npx prisma migrate dev` and `npx prisma generate`.

### Error Responses
- Return `reply.status(4xx).send({ message: '...' })` — match the `errorResponseSchema`.
- Don't leak internal error details (`e.message`) to the client.

## Adding Features

### New route in an existing module
1. Add Zod schema to `*.schemas.ts`.
2. Add route handler in `*.routes.ts` using `app.withTypeProvider<ZodTypeProvider>()`.
3. Tag the route for Swagger: `tags: ['Auth']` or `tags: ['Tasks']`.

### New module
1. `src/modules/<name>/<name>.schemas.ts` — Zod schemas.
2. `src/modules/<name>/<name>.routes.ts` — `export const myRoutes: FastifyPluginAsync`.
3. Register in `src/server.ts`: `server.register(myRoutes, { prefix: '/api/<name>' })`.
4. Add a Swagger tag in the `tags` array in `server.ts`.

### New Prisma model
1. Edit `prisma/schema.prisma`.
2. Run `npx prisma migrate dev --name <description>`.
3. Run `npx prisma generate` (regenerates `src/generated/prisma` and `src/generated/zod`).
4. Do **not** manually edit files under `src/generated/` — they are auto-generated.

## What NOT to Do

- Do not edit `src/generated/**` manually.
- Do not add raw SQL — use Prisma query API.
- Do not log passwords, tokens, or full error stacks to `console`.
- Do not store JWT secrets or DB URLs in code — use `.env`.
- Do not skip Swagger `schema` declarations — they power both validation and docs.
- Do not use `any` types — infer from Zod schemas with `z.infer<typeof schema>`.

## Environment Variables

| Variable       | Required | Description                        |
|----------------|----------|------------------------------------|
| `DATABASE_URL` | Yes      | PostgreSQL connection string       |
| `JWT_SECRET`   | Yes      | Secret for signing JWT tokens      |
| `REDIS_URL`    | No       | Redis URL (default: localhost:6379) |

## Useful Commands

```bash
npm run dev                          # Start dev server (tsx watch)
npm run lint:fix                     # Lint + format
npx prisma studio                    # Browse DB
npx prisma migrate dev --name <msg>  # Create + apply migration
npx prisma generate                  # Regenerate client + Zod types
```

## Testing

No test framework is configured yet. Before adding tests, choose a framework (e.g., `vitest`) and document it here.
