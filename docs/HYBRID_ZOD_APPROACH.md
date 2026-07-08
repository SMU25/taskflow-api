# Гібридний підхід до валідації: Prisma + Zod

Цей проєкт використовує **гібридний підхід** для створення валідаційних схем:
- 🔄 **Автоматична генерація** базових Zod схем з Prisma моделей
- 🎨 **Ручна кастомізація** для створення API-специфічних схем

## 🏗️ Архітектура

```
prisma/schema.prisma
    ↓ (npx prisma generate)
src/generated/zod/
    ├── TaskSchema         (базова схема)
    ├── UserSchema         (базова схема)
    └── ...
    ↓ (використання .pick(), .partial(), .extend())
src/modules/*/schemas.ts
    ├── createTaskBodySchema
    ├── updateTaskBodySchema
    └── taskResponseSchema
```

## 📝 Патерни використання

### 1. **Створення (Create) - .pick() + .extend()**

Використовуємо `.pick()` щоб взяти потрібні поля, `.extend()` для кастомізації:

```typescript
import { TaskSchema } from '../../generated/zod';

export const createTaskBodySchema = TaskSchema.pick({
  title: true,
  description: true,
}).extend({
  // API приймає string дати, а не Date
  dueDate: z.string().datetime().optional(),
});

// Результат: { title, description, dueDate? }
```

### 2. **Оновлення (Update) - .partial() + .pick()**

Використовуємо `.partial()` щоб зробити всі поля optional:

```typescript
export const updateTaskBodySchema = TaskSchema.partial().pick({
  title: true,
  description: true,
  status: true,
});

// Результат: { title?, description?, status? }
```

### 3. **Відповідь (Response) - як є або .extend()**

Якщо response = DB модель, використовуємо схему як є:

```typescript
export const taskResponseSchema = TaskSchema;
```

Якщо потрібні додаткові поля (relations):

```typescript
export const taskWithUserSchema = TaskSchema.extend({
  user: z.object({
    id: z.string(),
    email: z.string(),
  }),
});
```

### 4. **Виключення полів - .omit()**

Коли легше виключити кілька полів ніж перерахувати всі потрібні:

```typescript
// Всі поля крім id, userId, timestamps
export const publicTaskSchema = TaskSchema.omit({
  userId: true,
  createdAt: true,
  updatedAt: true,
});
```

### 5. **Комбінації методів**

```typescript
// Часткове оновлення, без id та timestamp полів
export const updateTaskSchema = TaskSchema
  .omit({ id: true, userId: true, createdAt: true, updatedAt: true })
  .partial();

// Створення з додатковою валідацією
export const createWithExtraValidation = TaskSchema
  .pick({ title: true, description: true })
  .extend({
    title: z.string().min(3).max(100), // Додаткові правила
    tags: z.array(z.string()).max(5),  // Нові поля
  });
```

## 🎯 Коли що використовувати

| Сценарій | Метод | Приклад |
|----------|-------|---------|
| Вибрати кілька полів | `.pick()` | Create DTO (title, description) |
| Виключити кілька полів | `.omit()` | Public response (без userId) |
| Всі поля optional | `.partial()` | Update/Patch DTO |
| Додати нові поля | `.extend()` | API-специфічні поля |
| Змінити тип поля | `.extend()` + override | Date → string для API |
| Використати як є | TaskSchema | Response = DB модель |

## 🔧 Додавання валідації в Prisma

Можна додавати Zod-специфічну валідацію прямо в Prisma схемі:

```prisma
model Task {
  title       String     /// @zod.string.min(1, { message: "Title is required" })
  description String?    /// @zod.string.max(500)
  email       String     /// @zod.string.email()
}
```

Після `npx prisma generate` ці правила автоматично будуть в згенерованих Zod схемах!

## 📦 Workflow

### При зміні Prisma схеми:

```bash
# 1. Змінюєте prisma/schema.prisma
# 2. Генеруєте нові типи
npx prisma generate

# 3. Створюєте міграцію (якщо змінювали структуру)
npx prisma migrate dev --name your_migration_name

# 4. Все! Ваші Zod схеми автоматично оновилися
```

### При додаванні нового модуля:

```typescript
// 1. Імпортуйте згенеровану схему
import { UserSchema } from '../../generated/zod';

// 2. Створіть API-специфічні схеми
export const registerBodySchema = UserSchema.pick({
  email: true,
  password: true,
});

export const loginBodySchema = UserSchema.pick({
  email: true,
  password: true,
});

export const userResponseSchema = UserSchema.omit({
  password: true, // НЕ повертаємо пароль в API
});
```

## ⚠️ Важливі нотатки

1. **Не редагуйте `src/generated/zod/index.ts` вручну** - він перегенерується при `npx prisma generate`

2. **z.coerce.date()** в згенерованих схемах автоматично конвертує string → Date. Якщо API приймає string, перевизначте через `.extend()`

3. **Enum'и генеруються автоматично**:
   ```typescript
   // Автоматично згенерується:
   export const TaskStatusSchema = z.enum(['pending', 'in_progress', 'completed']);
   ```

4. **Після кожного `npx prisma generate` перевіряйте `src/generated/zod/index.ts`** чи все коректно згенерувалось

## 🎓 Приклади з проєкту

Дивіться `src/modules/tasks/tasks.schemas.ts` для прикладів використання всіх патернів!

## 🔗 Корисні посилання

- [Zod Documentation](https://zod.dev)
- [zod-prisma-types](https://github.com/chrishoermann/zod-prisma-types)
- [Prisma Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
