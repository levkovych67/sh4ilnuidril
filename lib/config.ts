export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://isusneisus.com';

/** Доступ до серверних env зі зрозумілою помилкою за відсутності. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}
