import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import productExample from './fixtures/product.example.json';

const BASE = 'http://test-api:8081';
const TOKEN = 'test-token-12345';

async function loadModule() {
  vi.resetModules();
  process.env.PRODUCTS_API_BASE_URL = BASE;
  process.env.PRODUCTS_API_TOKEN = TOKEN;
  return await import('../products');
}

type MockOpts =
  | { status: number; body?: unknown }
  | { reject: unknown };

function mockFetchOnce(opts: MockOpts) {
  vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async () => {
    if ('reject' in opts) throw opts.reject;
    return new Response(opts.body === undefined ? '' : JSON.stringify(opts.body), {
      status: opts.status,
      headers: { 'content-type': 'application/json' },
    });
  });
}

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.PRODUCTS_API_BASE_URL;
  delete process.env.PRODUCTS_API_TOKEN;
});

describe('getProduct', () => {
  it('returns a parsed Product on 200', async () => {
    mockFetchOnce({ status: 200, body: productExample });
    const { getProduct } = await loadModule();
    const product = await getProduct('drop-01-oversize');
    expect(product.productId).toBe('drop-01-oversize');
    expect(product.productPrice).toBe(2600);
    expect(product.productPictures).toHaveLength(3);
  });

  it('sends Authorization: Bearer header', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify(productExample), { status: 200 }),
      );
    const { getProduct } = await loadModule();
    await getProduct('drop-01-oversize');
    const [, init] = fetchSpy.mock.calls[0]!;
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${TOKEN}`);
  });

  it('sets force-cache, products tag, and an AbortSignal', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify(productExample), { status: 200 }),
      );
    const { getProduct } = await loadModule();
    await getProduct('drop-01-oversize');
    const [, init] = fetchSpy.mock.calls[0]!;
    const i = init as RequestInit & { next?: { tags?: string[] } };
    expect(i.cache).toBe('force-cache');
    expect(i.next?.tags).toEqual(['products']);
    expect(i.signal).toBeDefined();
  });

  it('URL-encodes the id path segment', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 404 }));
    const { getProduct, ProductNotFoundError } = await loadModule();
    await expect(getProduct('weird id/with slash')).rejects.toBeInstanceOf(
      ProductNotFoundError,
    );
    const [url] = fetchSpy.mock.calls[0]!;
    expect(url).toBe(`${BASE}/products/weird%20id%2Fwith%20slash`);
  });

  it('throws ProductNotFoundError on 404', async () => {
    mockFetchOnce({ status: 404, body: { error: 'not_found' } });
    const { getProduct, ProductNotFoundError } = await loadModule();
    await expect(getProduct('missing')).rejects.toBeInstanceOf(ProductNotFoundError);
  });

  it('throws ProductsApiAuthError on 401', async () => {
    mockFetchOnce({ status: 401, body: { error: 'unauthorized' } });
    const { getProduct, ProductsApiAuthError } = await loadModule();
    await expect(getProduct('any')).rejects.toBeInstanceOf(ProductsApiAuthError);
  });

  it('throws ProductsApiError on 5xx', async () => {
    mockFetchOnce({ status: 500, body: { error: 'internal' } });
    const { getProduct, ProductsApiError } = await loadModule();
    await expect(getProduct('any')).rejects.toBeInstanceOf(ProductsApiError);
  });

  it('throws ProductsApiError on body that fails Zod', async () => {
    mockFetchOnce({ status: 200, body: { productId: 42 } });
    const { getProduct, ProductsApiError } = await loadModule();
    await expect(getProduct('any')).rejects.toBeInstanceOf(ProductsApiError);
  });

  it('throws ProductsApiError on AbortError (timeout)', async () => {
    const abort = new Error('aborted');
    abort.name = 'TimeoutError';
    mockFetchOnce({ reject: abort });
    const { getProduct, ProductsApiError } = await loadModule();
    await expect(getProduct('any')).rejects.toBeInstanceOf(ProductsApiError);
  });

  it('throws ProductsApiError on network failure', async () => {
    mockFetchOnce({ reject: new TypeError('fetch failed') });
    const { getProduct, ProductsApiError } = await loadModule();
    await expect(getProduct('any')).rejects.toBeInstanceOf(ProductsApiError);
  });
});

describe('listProducts', () => {
  it('returns Product[] from the items envelope on 200', async () => {
    mockFetchOnce({ status: 200, body: { items: [productExample] } });
    const { listProducts } = await loadModule();
    const items = await listProducts();
    expect(items).toHaveLength(1);
    expect(items[0]!.productId).toBe('drop-01-oversize');
  });

  it('returns an empty array when items is empty', async () => {
    mockFetchOnce({ status: 200, body: { items: [] } });
    const { listProducts } = await loadModule();
    expect(await listProducts()).toEqual([]);
  });

  it('throws ProductsApiError when items is missing', async () => {
    mockFetchOnce({ status: 200, body: { not_items: [] } });
    const { listProducts, ProductsApiError } = await loadModule();
    await expect(listProducts()).rejects.toBeInstanceOf(ProductsApiError);
  });

  it('throws ProductsApiError on 5xx', async () => {
    mockFetchOnce({ status: 503, body: { error: 'internal' } });
    const { listProducts, ProductsApiError } = await loadModule();
    await expect(listProducts()).rejects.toBeInstanceOf(ProductsApiError);
  });
});

describe('logging', () => {
  it('does NOT include the bearer token in console.error output', async () => {
    mockFetchOnce({ status: 500, body: { error: 'internal' } });
    const { getProduct } = await loadModule();
    await expect(getProduct('any')).rejects.toThrow();
    const allLoggedText = errorSpy.mock.calls
      .map((args) => args.map((a) => JSON.stringify(a)).join(' '))
      .join('\n');
    expect(allLoggedText).not.toContain(TOKEN);
  });

  it('logs a 5xx with the URL and status', async () => {
    mockFetchOnce({ status: 502, body: { error: 'internal' } });
    const { getProduct } = await loadModule();
    await expect(getProduct('whatever')).rejects.toThrow();
    expect(errorSpy).toHaveBeenCalledWith(
      '[products-api]',
      expect.objectContaining({ status: 502 }),
    );
  });

  it('does NOT log a 404 (it is an expected business outcome)', async () => {
    mockFetchOnce({ status: 404 });
    const { getProduct } = await loadModule();
    await expect(getProduct('missing')).rejects.toThrow();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
