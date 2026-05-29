export type PermissionDefinition = {
  key: string;
  label: string;
  category: string;
  group: string;
  kind: "page" | "action";
  description?: string;
};

export type StageDefinition = {
  key: string;
  label: string;
  description?: string;
  order: number;
};

export type PermissionsCatalog = {
  categories: Record<string, string>;
  permissions: PermissionDefinition[];
  stages: StageDefinition[];
};

async function parseError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" ? body.error : fallback;
  } catch {
    return fallback;
  }
}

export const permissionsApi = {
  async getCatalog(): Promise<PermissionsCatalog> {
    const response = await fetch("/api/permissions/catalog", { credentials: "include" });
    if (!response.ok) throw new Error(await parseError(response, "Não foi possível carregar o catálogo de permissões."));
    return (await response.json()) as PermissionsCatalog;
  },
};
