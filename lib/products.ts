import 'server-only';
import { z } from 'zod';
import { requireEnv } from './config';

const PictureSchema = z.object({
  url: z.string().min(1),
  alt: z.string().min(1),
});

export const ProductSchema = z.object({
  productId: z.string().min(1),
  productName: z.string().min(1),
  productDescription: z.string(),
  productPrice: z.number().int().nonnegative(),
  productVideoUrl: z.string().min(1),
  productVideoPosterUrl: z.string().min(1),
  productPictures: z.array(PictureSchema).min(1),
  productBrand: z.string(),
  productAvailability: z.enum(['in_stock', 'sold_out']),
  productButtonLabel: z.string(),
  productButtonBackgroundColor: z.string(),
  productButtonFontColor: z.string(),
});

export const ProductListSchema = z.object({ items: z.array(ProductSchema) });

export type Product = z.infer<typeof ProductSchema>;

export class ProductsApiError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ProductsApiError';
  }
}

export class ProductsApiAuthError extends ProductsApiError {
  constructor() {
    super('unauthorized');
    this.name = 'ProductsApiAuthError';
  }
}

export class ProductNotFoundError extends ProductsApiError {
  constructor(id: string) {
    super(`not_found: ${id}`);
    this.name = 'ProductNotFoundError';
  }
}

const TIMEOUT_MS = 5_000;

interface FetchOutcome {
  body: unknown;
}

async function callApi(path: string): Promise<FetchOutcome> {
  const baseUrl = requireEnv('PRODUCTS_API_BASE_URL');
  const token = requireEnv('PRODUCTS_API_TOKEN');
  const url = `${baseUrl}${path}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'force-cache',
      next: { tags: ['products'] },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (cause) {
    const isTimeout =
      cause instanceof Error &&
      (cause.name === 'TimeoutError' || cause.name === 'AbortError');
    console.error('[products-api]', {
      url,
      status: 'fetch-failed',
      reason: isTimeout ? 'timeout' : 'network',
    });
    throw new ProductsApiError(isTimeout ? 'timeout' : 'network', { cause });
  }

  if (res.status === 401) {
    console.error('[products-api]', { url, status: 401 });
    throw new ProductsApiAuthError();
  }
  // 404 is a meaningful "not found" — do not log; caller decides whether it
  // is an error case (getProduct: yes; nothing else uses 404).
  if (res.status === 404) {
    throw new ProductNotFoundError(path);
  }
  if (!res.ok) {
    const bodyPreview = await res
      .text()
      .then((t) => t.slice(0, 500))
      .catch(() => '');
    console.error('[products-api]', { url, status: res.status, bodyPreview });
    throw new ProductsApiError(`http_${res.status}`);
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch (cause) {
    console.error('[products-api]', { url, status: res.status, reason: 'json-parse' });
    throw new ProductsApiError('contract_violation', { cause });
  }
  return { body };
}

export async function listProducts(): Promise<Product[]> {
  const { body } = await callApi('/products');
  const parsed = ProductListSchema.safeParse(body);
  if (!parsed.success) {
    console.error('[products-api]', {
      url: '/products',
      status: 200,
      reason: 'zod-parse',
    });
    throw new ProductsApiError('contract_violation', { cause: parsed.error });
  }
  return parsed.data.items;
}

export async function getProduct(id: string): Promise<Product> {
  let outcome: FetchOutcome;
  try {
    outcome = await callApi(`/products/${encodeURIComponent(id)}`);
  } catch (err) {
    if (err instanceof ProductNotFoundError) {
      // Rewrite the path-based "not_found: /products/foo" message to the slug.
      throw new ProductNotFoundError(id);
    }
    throw err;
  }
  const parsed = ProductSchema.safeParse(outcome.body);
  if (!parsed.success) {
    console.error('[products-api]', {
      url: `/products/${id}`,
      status: 200,
      reason: 'zod-parse',
    });
    throw new ProductsApiError('contract_violation', { cause: parsed.error });
  }
  return parsed.data;
}
