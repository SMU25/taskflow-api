export interface CreateWorkspaceData {
  name: string;
  slug: string;
}

// Форму пишемо явно: `interface X extends Partial<...> {}` з порожнім тілом
// еквівалентний своєму супертипу — ESLint (no-empty-object-type) це блокує,
// і коментар усередині його не вимикає (коментар — не член інтерфейсу).
export interface UpdateWorkspaceData {
  name?: string;
}
