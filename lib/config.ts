import { PRODUCTS, type Product } from './catalog';

/** Legacy alias kept for backward-compat during the multi-product migration.
 *  All new code should import from `@/lib/catalog` directly. Removed in the
 *  final cleanup task. */
export const PRODUCT: Product = PRODUCTS[0];

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://isusneisus.com';

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}
