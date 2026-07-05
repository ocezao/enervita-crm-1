import type { LeadPipeline } from './types';

async function parseError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === 'string' ? body.error : fallback;
  } catch {
    return fallback;
  }
}

export const pipelinesApi = {
  async list(): Promise<LeadPipeline[]> {
    const response = await fetch('/api/pipelines', { credentials: 'include' });
    if (!response.ok) throw new Error(await parseError(response, 'Nao foi possivel carregar pipelines.'));
    const body = (await response.json()) as { pipelines: LeadPipeline[] };
    return body.pipelines;
  },
};
