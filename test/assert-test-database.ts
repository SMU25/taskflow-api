/** Запобіжник: міграції й TRUNCATE ніколи не мають дістати dev-базу. */
export function assertTestDatabase(
  raw: string | undefined,
): asserts raw is string {
  const name = raw ? new URL(raw).pathname : '(unset)';

  if (!name.endsWith('_test')) {
    throw new Error(`Refusing to touch a non-test database: ${name}`);
  }
}
