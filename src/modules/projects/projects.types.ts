/** Ключ рядка: проєкт ЗАВЖДИ шукаємо разом із воркспейсом (IDOR). */
export interface ProjectScope {
  id: string;
  workspaceId: string;
}

export interface CreateProjectData {
  name: string;
  workspaceId: string;
}

export interface UpdateProjectData {
  name?: string;
}
