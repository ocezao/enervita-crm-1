import { screen, waitFor } from '@testing-library/react';
import { expect, type Mock } from 'vitest';

type FetchMock = Mock<(input: RequestInfo | URL, init?: RequestInit) => Promise<unknown>>;
type RouteHandler = (init?: RequestInit, url?: string) => unknown | Promise<unknown>;

export function expectFetchCalled(
  fetchMock: FetchMock,
  url: string,
  partialInit: RequestInit | { asymmetricMatch: (actual: unknown) => boolean } = {},
) {
  const matchedCall = fetchMock.mock.calls.find(([calledUrl, init]) => {
    if (String(calledUrl) !== url) return false;

    if ('asymmetricMatch' in partialInit) {
      return partialInit.asymmetricMatch(init ?? {});
    }

    if (Object.keys(partialInit).length === 0) return true;

    try {
      expect(init ?? {}).toEqual(expect.objectContaining(partialInit));
      return true;
    } catch {
      return false;
    }
  });

  expect(matchedCall, `Expected fetch to be called with ${url}`).toBeTruthy();
}

export async function waitForFetchCalled(fetchMock: FetchMock, url: string, partialInit: RequestInit = {}) {
  await waitFor(() => expectFetchCalled(fetchMock, url, partialInit));
}

export async function findByAnyText(texts: Array<string | RegExp>) {
  for (const text of texts) {
    const match = screen.queryByText(text);
    if (match) return match;
  }

  return screen.findByText(texts[0]);
}

export function getFieldBySemanticName(name: 'area' | 'role' | 'department' | 'jobTitle' | string) {
  const aliases: Record<string, RegExp[]> = {
    area: [/area\/funcao/i, /área\/função/i, /departamento/i, /funcao/i, /função/i, /area/i, /área/i],
    role: [/cargo/i, /funcao/i, /função/i],
    department: [/departamento/i, /area/i, /área/i],
    jobTitle: [/cargo/i, /funcao/i, /função/i],
  };

  for (const alias of aliases[name] ?? [new RegExp(name, 'i')]) {
    const field = screen.queryByLabelText(alias);
    if (field) return field;
  }

  throw new Error(`No field found for semantic name: ${name}`);
}

export function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

export function mockApiRouter(routes: Record<string, RouteHandler>) {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const routeKey = init?.method ? `${init.method} ${url}` : url;
    const handler = routes[routeKey] ?? routes[url];

    if (!handler) {
      return jsonResponse({ error: `Unmocked endpoint: ${routeKey}` }, 404);
    }

    return handler(init, url);
  };
}
