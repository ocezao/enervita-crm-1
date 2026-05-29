export type AppEnv = {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  sessionSecret: string;
};

const DEFAULT_PORT = 4000;
const DEFAULT_DATABASE_URL = 'postgres://enervita:enervita@127.0.0.1:55432/enervita_crm';
const DEVELOPMENT_SESSION_SECRET = 'development-session-secret-change-before-production';

function parsePort(value: string | undefined): number {
  if (value === undefined || value.trim() === '') {
    return DEFAULT_PORT;
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  return port;
}

function readSessionSecret(env: NodeJS.ProcessEnv, nodeEnv: string): string {
  const value = env.SESSION_SECRET?.trim();
  if (value) {
    if (value.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters.');
    return value;
  }

  if (nodeEnv === 'production') {
    throw new Error('SESSION_SECRET is required in production.');
  }

  return DEVELOPMENT_SESSION_SECRET;
}

export function readEnv(env: NodeJS.ProcessEnv = process.env): AppEnv {
  const nodeEnv = env.NODE_ENV?.trim() || 'development';

  return {
    nodeEnv,
    port: parsePort(env.PORT),
    databaseUrl: env.DATABASE_URL?.trim() || DEFAULT_DATABASE_URL,
    sessionSecret: readSessionSecret(env, nodeEnv),
  };
}
