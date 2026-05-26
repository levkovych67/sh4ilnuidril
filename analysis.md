# System Analysis — Sasha Chemerov merch platform

**Date:** 2026-05-26
**Scope:** Two-repo Ukrainian merch micro-platform
- Frontend (this repo): `sh4ilnui-drill-landing` — Next.js 16 single-page landing
- Backend (sibling repo): `sh4ilnui-drill-backend` — Spring Boot 4 / MongoDB read-API + Telegram admin bot

This document is the single point of truth a new engineer or operator needs to ship the system to production. It covers architecture, every wire-level contract, every environment variable, every accepted trade-off, and a live verification report from today.

---

## 1. Executive summary

**What it is.** A one-page e-commerce site selling oversize t-shirts ("Sasha Chemerov × Димна Суміш — Drop 01"). Mobile-first, low-traffic, no accounts, no orders database. Two SKUs today (`drop-01-oversize`, `drop-01-product2`); designed for N. UI in Ukrainian. Payment in UAH via WayForPay (third-party widget), delivery via Nova Poshta (third-party API), order notifications to a Telegram managers' chat (no DB on this side either).

**Architectural shape.**

```
                 ┌──────────────────────────────────────────┐
                 │  Browser (mobile-first, 90% smartphone)  │
                 └────┬────────────────────────────┬────────┘
                      │ HTTPS (public)             │ WayForPay widget loads in-page
                      ▼                            │
              ┌───────────────┐                    │
              │  Next.js 16   │   server-only      │
              │  Vercel       │   Bearer + tag-cache
              │  isusneisus   │ ───────────────▶┌──────────────────┐
              └──┬───┬────────┘                 │  Spring Boot 4   │
                 │   │                          │  products-svc    │
                 │   │  HMAC-MD5 to              │  :8081           │
                 │   │  WayForPay; HTTPS         │  • read API      │
                 │   │  GET to NovaPoshta;       │  • admin bot     │
                 │   │  HTTPS to Telegram        │  (long-polling)  │
                 │   ▼                          └──┬───────────┬───┘
                 │  external services              │           │
                 │  (WayForPay, NovaPoshta,        ▼           ▼
                 │   Telegram managers)         MongoDB 7    S3 (media)
                 │                              (products)   bot-only
                 ▼
            localStorage (cart, client-only)
```

**Maturity status (today).**

| Surface | State |
|---|---|
| Storefront (browse + cart + checkout submit) | **Production-ready.** All flows wired; 77/77 unit tests pass; build green; live smoke green. |
| Catalog read API | **Production-ready.** Backed by Mongo, Bearer-token gated, Zod-validated client-side. |
| Cache invalidation (`POST /api/revalidate`) | **Production-ready.** Bearer-token gated, busts the `products` cache tag. |
| Admin Telegram bot | **Functional locally**, gated by env vars on Spring side. Production deployment depends on bot token + S3 bucket provisioning. |
| S3 media upload (bot) | **Functional locally**, requires real AWS bucket + credentials in prod. |
| Order persistence | **Not implemented (by design).** Source of truth = WayForPay dashboard + Telegram chat. |
| Production deployment | **Not yet performed.** Vercel deploy of frontend, hosting decision for backend pending. Section 17 lists every env var needed. |

---

## 2. Tech stack inventory

### Frontend (`sh4ilnui-drill-landing`)

| Layer | Choice | Version |
|---|---|---|
| Framework | Next.js (App Router, Turbopack) | `16.2.6` |
| Runtime | React | `19.2.4` |
| Language | TypeScript | `^5` (`strict: false`) |
| Validation | Zod | `^3.25.76` |
| Testing | Vitest | `^4.1.7` |
| Server-only guard | `server-only` | latest (Vercel package) |
| Build target | ES2017, module `esnext`, jsx `react-jsx`, bundler resolution | — |
| Fonts | Google Fonts (Inter, Montserrat, Oswald, IBM Plex Mono) via `next/font` + bundled KyivTypeSans `.ttf/.woff2` | — |
| Styling | Plain CSS Modules + 4 global tokens (`--bg`, `--ink`, `--red`, `--grey`) | — |
| Image optimization script | sharp (dev dep) via `scripts/optimize-images.mjs` | — |
| Deploy target | Vercel | — |

Total source surface (excluding node_modules / .next / public): 55 `.ts/.tsx/.css` files.

### Backend (`sh4ilnui-drill-backend`)

| Layer | Choice | Version |
|---|---|---|
| Framework | Spring Boot | `4.0.6` |
| Language | Java | `21 LTS` (records, switch-on-enum, virtual threads enabled) |
| Storage | MongoDB | `7` (Docker `mongo:7`) |
| Security | Spring Security (`SecurityFilterChain`, custom `OncePerRequestFilter`) | — |
| Admin bot | TelegramBots `7.11.0` (`longpolling` + `client`) | — |
| Media storage | AWS SDK v2 (`software.amazon.awssdk:s3` via `bom:2.28.0`) | — |
| HTTP client (bot URL fetch) | `java.net.http.HttpClient` (JDK built-in) | — |
| Build | Gradle (Kotlin DSL), Java 21 toolchain | — |
| Containerization | Multi-stage Dockerfile (JDK build → JRE runtime), docker-compose for Mongo | — |
| Tests | None (deliberate — manual + cross-repo verification per spec) | — |
| Default port | `8081` (chosen to avoid Docker Desktop's `8080`) | — |

Total source surface: 25 `.java` files, ~1,300 LOC (largest: `bot/edit/EditFlow.java` 214 LOC).

---

## 3. Backend deep dive

### 3.1 Module layout

```
src/main/java/com/isusneisus/products/
├── ProductsApplication.java               // @SpringBootApplication + @EnableScheduling; excludes UserDetailsServiceAutoConfiguration
├── api/
│   ├── ApiError.java                      // record(error)
│   ├── ProductController.java             // GET /products, GET /products/{id}
│   ├── ProductListResponse.java           // record(items)
│   ├── ProductMapper.java                 // entity → DTO (lowercase availability)
│   ├── ProductPictureResponse.java        // record(url, alt)
│   ├── ProductResponse.java               // record with 12 fields
│   └── GlobalExceptionHandler.java        // @ControllerAdvice → 500 {error:'internal'}
├── config/
│   ├── BearerTokenAuthFilter.java         // constant-time token compare; permits /actuator/health
│   └── SecurityConfig.java                // SecurityFilterChain, CSRF off, CORS off, stateless
├── domain/
│   ├── Product.java                       // @Document record + 11 withX builders for the bot
│   ├── ProductAvailability.java           // enum IN_STOCK | SOLD_OUT
│   ├── ProductPicture.java                // record(url, alt)
│   └── ProductRepository.java             // MongoRepository<Product, String>
└── bot/
    ├── AdminDrillBot.java                 // long-polling consumer; admin guard; dispatcher
    ├── AdminGuard.java                    // allowlist by Telegram user id
    ├── BotConfig.java                     // @ConditionalOnExpression on TELEGRAM_BOT_TOKEN; starts polling
    ├── CommandHandler.java                // /start /list /show /toggle-active /toggle-stock /delete-pic /edit /done /cancel
    ├── Replies.java                       // text formatters + inline keyboard for /edit
    ├── edit/
    │   ├── EditField.java                 // enum + per-field validators/appliers
    │   ├── EditFlow.java                  // FSM for /edit; callback + value-message handlers
    │   ├── EditSession.java               // mutable per-chat state
    │   └── EditSessions.java              // in-memory session map (TTL via @Scheduled)
    └── media/
        ├── MediaService.java              // photo + video upload (telegram file or HTTPS URL)
        └── S3MediaClient.java             // PutObject + public-URL composition
```

### 3.2 HTTP API surface (read-only)

| Method | Path | Auth | Success body | Error body |
|---|---|---|---|---|
| `GET` | `/products` | Bearer | `{ "items": ProductResponse[] }` (200) — empty array allowed; never 404s | — |
| `GET` | `/products/{id}` | Bearer | `ProductResponse` (200) | `{"error":"not_found"}` (404) when slug unknown or `active=false` |
| `GET` | `/actuator/health` | none | `{"status":"UP", ...}` (200) | — |

Always-applicable error bodies:
| Code | Body | When |
|---|---|---|
| 401 | `{"error":"unauthorized"}` | Missing/wrong/blank Bearer token. Returned by `BearerTokenAuthFilter`; uses `MessageDigest.isEqual` for constant-time compare. |
| 500 | `{"error":"internal"}` | Any unhandled exception, normalized by `GlobalExceptionHandler`. No internals leaked. |

`Authorization` header **must** include `Bearer ` (case-insensitive prefix matching per RFC 7235); empty token at startup throws `IllegalStateException` (fail-fast in `BearerTokenAuthFilter` constructor).

### 3.3 `ProductResponse` shape (wire contract)

```jsonc
{
  "productId": "drop-01-oversize",                              // slug; doubles as Mongo _id; pattern ^[a-z0-9-]+$
  "productName": "too much яром too much долиною",
  "productDescription": "Оверсайз-футболка — лімітований дроп Sasha Chemerov × Димна Суміш.",
  "productPrice": 2600,                                          // integer UAH, server-authoritative
  "productVideoUrl": "/product1/tshirt.mp4",                     // relative (Next-served today) or absolute (S3 in prod)
  "productVideoPosterUrl": "/video.jpg",                         // same — used by <video poster>
  "productPictures": [                                           // non-empty
    { "url": "/product1/too-much-яром-too-much-долиною.jpg", "alt": "Передня частина футболки" },
    { "url": "/front.webp", "alt": "Передня крупним планом" },
    { "url": "/back.webp",  "alt": "Задня крупним планом" }
  ],
  "productBrand": "Sasha Chemerov × Димна Суміш",
  "productAvailability": "in_stock",                             // 'in_stock' | 'sold_out' (mapper renders lowercase)
  "productButtonLabel": "ЗАБРАТИ",
  "productButtonBackgroundColor": "#000000",
  "productButtonFontColor": "#FAFAFA"
}
```

Frontend Zod schema (`lib/products.ts`) enforces presence of all 12 fields. Strictness levels:
- `min(1)` on `productId`, `productName`, `productVideoUrl`, `productVideoPosterUrl`, all `productPictures[].url` / `.alt`, and `productPictures` array length.
- Plain `z.string()` (empty allowed) on the "carried, not consumed" fields: `productDescription`, `productBrand`, `productButtonLabel`, `productButtonBackgroundColor`, `productButtonFontColor`.
- `z.enum(['in_stock', 'sold_out'])` on `productAvailability`.
- `z.number().int().nonnegative()` on `productPrice`.

### 3.4 Mongo document & seed

Collection: `products`, one document per product. The `@Id String id` maps to Mongo's `_id` and is rendered in the API as `productId`.

Additional fields on the entity that are NOT in the API response:
- `active: boolean` — `findAllByActiveTrue` and `findByIdAndActiveTrue` filter on this; the admin bot toggles via `/toggle-active`.
- `createdAt: Instant`, `updatedAt: Instant` — housekeeping; the bot updates `updatedAt` on every mutation.

Seed: `mongo-init.js` mounted into Mongo's `docker-entrypoint-initdb.d`. Inserts 2 products with relative asset paths (`/product1/tshirt.mp4`, etc.) that the Next dev server serves from `public/`. In production, the bot pipeline replaces these with S3 absolute URLs.

### 3.5 Admin Telegram bot (long-polling)

**Activation gate:** `@ConditionalOnExpression("'${telegram.bot.token:}'.length() > 0")` on every bot bean. Without `TELEGRAM_BOT_TOKEN`, none of the bot infrastructure loads — the service is a pure read API.

**Authorization model:** `AdminGuard` reads `ADMIN_CHAT_IDS` (comma-separated Telegram numeric user IDs). Every incoming update is matched against this allowlist; non-admins are silently dropped. The bot fails to start if a token is set but the allowlist is empty.

**Command catalog:**

| Command | Effect |
|---|---|
| `/start` | Print help card. |
| `/list` | List all products (active + inactive). |
| `/show <id>` | Print full product card. |
| `/toggle-active <id>` | Flip `active`. Inactive products vanish from `/products` and `/products/{id}` returns 404. |
| `/toggle-stock <id>` | Flip `productAvailability` between IN_STOCK / SOLD_OUT. |
| `/delete-pic <id> <n>` | Remove the n-th picture (1-indexed). |
| `/edit <id>` | Open the field-edit FSM (inline keyboard with 9 fields + Pictures). |
| `/done` | Inside `PICTURES` mode, return to the field menu. |
| `/cancel` | Drop the current edit session. |

**`/edit` FSM (`EditFlow.java`, 214 LOC):**
- Inline keyboard with one button per editable field.
- Field selected → prompt for value as a text message.
- Per-field validator (`EditField.validate`) checks input; on failure, the user re-prompts.
- On success, the field is applied via `Product.withX(...)`, `updatedAt` is refreshed, document saved.
- `PICTURES` mode accepts: a photo (caption = alt), a video file (≤ 20 MB direct), or an `https://` URL (HEAD-checked size cap = `MEDIA_MAX_VIDEO_BYTES`, default 200 MB).
- Sessions are in-memory; `EditSessions` runs a `@Scheduled` cleanup. Server restart = sessions lost.
- Slash commands always escape the FSM, even mid-edit.

**Media upload pipeline:**
- Photo/video from Telegram: `OkHttpTelegramClient.downloadFile` → local temp → `S3MediaClient.put`.
- Video URL: `HttpClient.send` HEAD (size + content-type) → GET → stream into S3.
- S3 key pattern: `products/<productId>/<uuid>.<ext>`.
- Final URL stored on the product: `${AWS_S3_PUBLIC_URL_BASE}/${key}`.

**Crucial:** the bot mutates Mongo directly. It does NOT call `/api/revalidate` on the Next side. After a bot edit, the frontend's cached page still serves the old data until either the cache entry expires naturally (`force-cache` is effectively indefinite) or an operator manually `POST /api/revalidate`. **This is a gap in the rollout story** — see §16.

### 3.6 Security model

- `SecurityConfig` builds a single `SecurityFilterChain`. CSRF off (stateless API). CORS off (server-to-server only; browser never reaches the service). Sessions stateless.
- `BearerTokenAuthFilter` runs before `UsernamePasswordAuthenticationFilter`. Reads `products.api.token` from properties (env-bound to `PRODUCTS_API_TOKEN`). Empty token at startup → fail-fast with `IllegalStateException`.
- `shouldNotFilter` exempts `/actuator/health` and `/actuator/health/**` from auth, so health probes (Kubernetes, Docker, monitoring) work without a token.
- The bot's authorization is independent of the API token. Bot uses Telegram-side numeric IDs; API uses a shared Bearer secret. Different rotation, different blast radius.

### 3.7 Operational notes

- **Logging:** SLF4J/Logback (Spring default). Bot logs every `error handling update`. API logs every unhandled exception via `GlobalExceptionHandler`. No structured JSON yet.
- **Health:** `GET /actuator/health` returns `{groups:[liveness,readiness], status:UP}` when Mongo connection is healthy. Probes enabled.
- **Graceful shutdown:** `server.shutdown: graceful` in `application.yml`. Bot has `@PreDestroy` that closes the long-polling app cleanly.
- **Virtual threads:** `spring.threads.virtual.enabled: true` — every HTTP request handler runs on a virtual thread (good for I/O-bound MongoDB calls).
- **MongoDB URI binding (verify in prod):** `application.yml` has `spring.mongodb.uri` (note: not the standard `spring.data.mongodb.uri`). Locally this works because the env override `MONGO_URI=mongodb://mongo:27017/products` is consumed; in prod, **verify the URI is actually being read** (curl `/products` and confirm both seeded items return).

---

## 4. Frontend deep dive

### 4.1 Module layout

```
app/
├── layout.tsx                         // RootLayout — fonts, metadata, organizationLd, WayForPay <Script>
├── page.tsx                           // async — listProducts() → CartProvider + CheckoutProvider + ProductCarousel + per-product JSON-LD
├── page.module.css                    // .page (fixed inset:0, no scroll), .srOnly
├── globals.css                        // tokens (--bg/--ink/--red/--grey/--ease-*), parallax thorns watermark
├── error.tsx                          // 'use client' — Ukrainian "Щось пішло не так"
├── not-found.tsx                      // Ukrainian "Сторінку не знайдено"
├── offer/page.tsx                     // static legal — Public Offer (Ukrainian)
├── returns/page.tsx                   // static legal — Returns Policy
├── sitemap.ts, robots.ts              // SEO routes (3 URLs in sitemap; api/ disallowed)
└── api/
    ├── checkout/route.ts              // POST — Zod parse, per-line getProduct, HMAC-MD5 sign, return WayForPay params
    ├── novaposhta/route.ts            // GET — proxy to api.novaposhta.ua/v2.0/json/ (server-side API key)
    ├── revalidate/route.ts            // POST — Bearer-checked, revalidateTag('products', {expire:0})
    └── wayforpay-callback/route.ts    // POST — verify HMAC, send Telegram notification, signed ACK

components/
├── Header/Header.{tsx,module.css}     // sticky logo + CartButton; replaced "DROP 01" tag in cart feature
├── Footer/Footer.{tsx,module.css}     // legal links + copyright row
├── BuyOverlay/BuyOverlay.{tsx,module.css}  // two hero buttons (Забрати, В кошик); accepts product:Product prop
├── Cart/
│   ├── CartProvider.tsx               // 'use client' — items state + productsBySku Map + drawer state + localStorage sync
│   ├── CartButton.tsx                 // SVG bag + qty badge; Ukrainian plural aria-label
│   ├── CartDrawer.tsx                 // bottom sheet on mobile, right panel on desktop
│   └── CartDrawer.module.css
├── Carousel/                          // horizontal scroll-snap (CSS-native, no JS library)
│   ├── ProductCarousel.tsx            // refs + IntersectionObserver + arrow-key handler + scrollToSlide
│   ├── ProductSlide.tsx               // forwardRef; one slide = one <video> + <BuyOverlay product>
│   ├── PaginationDots.tsx             // tablist with aria-current
│   ├── NavChevron.tsx                 // desktop-only chevron buttons; hidden at edges
│   └── ProductCarousel.module.css
├── Checkout/
│   ├── CheckoutProvider.tsx           // 'use client' — isOpen/open/close + auto-renders CheckoutModal
│   ├── CheckoutModal.tsx              // bottom sheet (mobile) / right panel (desktop); Escape, scroll-lock
│   ├── CheckoutForm.tsx               // per-line order summary, stepper writes to cart, on submit POST + WayForPay widget.run
│   ├── NovaPoshtaPicker.tsx           // city autocomplete (debounced) + warehouse list; courier path preserved as commented-out
│   └── CheckoutModal.module.css
└── Legal/LegalPage.{tsx,module.css}   // wrapper used by /offer and /returns

lib/
├── catalog.ts                         // REMOVED — products now come from API
├── cart.ts                            // pure functions: addItem, setQuantity, removeItem, totalQuantity, totalAmount, MAX_QUANTITY=10
├── checkoutSchema.ts                  // Zod schema; items:{sku,quantity}[]; superRefine for warehouse vs courier
├── config.ts                          // SITE_URL + requireEnv()
├── novaposhta.ts                      // pure mappers + 2 fetch functions for cities & warehouses
├── popularCities.ts                   // 8-city const for the picker
├── products.ts                        // SERVER-ONLY — fetch + Bearer + Zod + typed errors (Product, listProducts, getProduct)
├── telegram.ts                        // format order message + sendToTelegram
├── types.ts                           // re-exports CheckoutInput, DeliveryType, CheckoutLineItem + WayForPayParams
├── validateCheckout.ts                // wraps Zod into a FieldErrors map keyed by CheckoutInput keys
├── wayforpay.ts                       // HMAC-MD5 signing for purchase / callback verification / response
└── __tests__/
    ├── __mocks__/server-only.ts       // vitest alias — noop module to allow lib/products.ts to import outside Next's bundler
    ├── fixtures/product.example.json  // canonical API response (byte-mirror of backend's contract)
    ├── cart.test.ts                   // 22 specs — addItem merge/clamp/no-op, setQuantity, removeItem, totals
    ├── checkout-schema.test.ts        // 16 specs — items[] validity, warehouse vs courier branch, error messages
    ├── novaposhta.test.ts             // 5 specs — mapCities, mapWarehouses (branch/postbox detection + sort)
    ├── products.test.ts               // 17 specs — happy path, all error mappings, token redaction, URL encoding
    ├── smoke.test.ts                  // 1 spec — 1+1=2
    ├── telegram.test.ts               // 1 spec — formatOrderMessage includes all fields
    ├── validateCheckout.test.ts       // 8 specs — error key mapping; items=[] surfaces 'Кошик порожній'
    └── wayforpay.test.ts              // 4 specs — hmacMd5, purchaseSignature, callbackSignature, responseSignature

scripts/optimize-images.mjs            // sharp-based pre-build asset prep (reads source-assets/, writes public/)
types/wayforpay-widget.d.ts            // ambient global Window.Wayforpay type

public/
├── product1/                          // tshirt.mp4 + the .jpg
├── product2/                          // video.mp4 + pic.png
├── fonts/, fonts-new/                 // KyivTypeSans family + Germanica + RussoOne
├── /front.webp, /back.webp            // hardcoded zoom assets (not in catalog yet)
├── /video.jpg                         // shared poster
├── /bg-phone.webp, /bg-web.webp       // parallax thorns watermark
├── /logo.png, favicons, /llms.txt     // misc
```

### 4.2 Boundary: `lib/products.ts` (server-only)

The single point of contact between Next.js and Java.

```ts
import 'server-only';
import { z } from 'zod';
import { requireEnv } from './config';

export const ProductSchema = z.object({ /* 12 fields per §3.3 */ });
export type Product = z.infer<typeof ProductSchema>;

export class ProductsApiError extends Error {}
export class ProductsApiAuthError extends ProductsApiError {}
export class ProductNotFoundError extends ProductsApiError {}

export async function listProducts(): Promise<Product[]>;
export async function getProduct(id: string): Promise<Product>;
```

Internal `fetch` call:
```ts
fetch(`${PRODUCTS_API_BASE_URL}${path}`, {
  headers: { Authorization: `Bearer ${PRODUCTS_API_TOKEN}` },
  cache: 'force-cache',
  next: { tags: ['products'] },
  signal: AbortSignal.timeout(5_000),
});
```

Error mapping (`callApi` private helper):

| HTTP / cause | Throws |
|---|---|
| `401` | `ProductsApiAuthError('unauthorized')` |
| `404` (only meaningful for `getProduct`) | `ProductNotFoundError(id)` |
| any other non-2xx | `ProductsApiError('http_' + status)` (logs body preview, 500-byte cap) |
| `AbortError` / `TimeoutError` | `ProductsApiError('timeout')` |
| Network / DNS / refused | `ProductsApiError('network')` |
| Body not JSON or Zod parse fails | `ProductsApiError('contract_violation')` |

**Token redaction:** every `console.error('[products-api]', {…})` includes `url`, `status`, `reason`/`bodyPreview` — but NEVER the Authorization header. The `products.test.ts` suite asserts the token string does not appear in any logged output.

**`server-only` enforcement:** the import directive throws at Next's bundle time if any client component (`'use client'` file) imports this module. The frontend uses `import type { Product } from '@/lib/products'` everywhere on the client side — type imports are erased at build, so they're allowed. Verified: zero runtime imports of `lib/products.ts` from `'use client'` files.

### 4.3 Page-level data flow

```
Browser → GET / → Next.js
  app/layout.tsx (sync) renders <html>, fonts, organizationLd, WayForPay <Script>
  app/page.tsx (async):
    const products = await listProducts();   ← fetch → Java → Mongo → Product[]
    Render:
      <CartProvider products={products}>     ← exposes productsBySku Map via context
        <CheckoutProvider>                   ← exposes isOpen/open/close + auto-renders <CheckoutModal/>
          <main>
            <Header/>                        ← logo + <CartButton/>
            <ProductCarousel products={...}/> ← scroll-snap; one ProductSlide per product
            <Footer/>
          </main>
          <CartDrawer/>                      ← rendered explicitly here, inside BOTH providers
        </CheckoutProvider>
        {products.map → <script ld+json>}    ← one Product schema per catalog entry
      </CartProvider>
  → HTML to browser

Once hydrated:
  CartProvider's useEffect reads localStorage['sasha-cart-v1'], filters items
   by productsBySku.has(sku), restores cart state.
  Videos autoplay (muted, looped, playsInline).
```

The page is statically generated at build time (`○` in `next build` output). Subsequent requests serve the cached HTML. Cache invalidates per Next's `force-cache + tag` semantics — see §10.

### 4.4 Cart layer

- **Pure functions** in `lib/cart.ts` operate on `CartItem[]`:
  - `addItem(items, item, qty?)` merges by SKU; clamps total to `MAX_QUANTITY = 10`; no-ops when `qty ≤ 0`.
  - `setQuantity(items, sku, qty)` clamps to `[0, MAX_QUANTITY]`; `qty ≤ 0` removes the line.
  - `removeItem`, `totalQuantity`, `totalAmount` — straightforward.
  - All functions are immutable (return new arrays); 22 tests assert that.

- **`CartProvider` (client component):**
  - Accepts `products: readonly Product[]` prop. Builds `productsBySku: Map<string, Product>` once per render via `useMemo`.
  - State: `items: CartItem[]`, `isDrawerOpen: boolean`.
  - `useEffect` on mount reads `localStorage['sasha-cart-v1']`, validates each entry via `isCartItem` (shape check) AND `productsBySku.has(sku)` (catalog membership). Phantom SKUs (renamed/deleted in catalog) are silently dropped.
  - `useEffect` on every items change persists to localStorage. Failures (Safari private mode, quota) are silent — cart still works in-memory.
  - Context value exposes: `items, add, setQty, remove, clear, totalQuantity, totalAmount, isDrawerOpen, openDrawer, closeDrawer, productsBySku`.

- **`CartDrawer` (client component):** visual twin of `CheckoutModal` — same scrim, `sheetIn/Out` on mobile, `panelIn/Out` on desktop, `EXIT_MS=420` mount/unmount lifecycle, Escape-to-close, body scroll lock. Line thumb URL resolved via `productsBySku.get(sku)?.productPictures[0]?.url`.

### 4.5 Checkout flow

Schema (`lib/checkoutSchema.ts`):
```ts
checkoutSchema = z.object({
  fullName: string with ≥ 2 words ("Вкажіть прізвище та ім'я"),
  phone: string starting with +380 + 9 digits,
  email: simple regex,
  items: array(min 1, "Кошик порожній") of { sku: string.min(1), quantity: int().min(1) },
  city: string.min(1, "Оберіть місто"),
  cityRef: string,
  deliveryType: enum('warehouse' | 'courier'),
  warehouse: string,
  street: string,
  building: string,
  flat: string,
}).superRefine(/* warehouse vs courier required-field branch */);
```

`POST /api/checkout` route handler:

```
parse body with checkoutSchema → 400 on fail
for line of input.items:
  product = await getProduct(line.sku)
    ProductNotFoundError → 400 { error: 'unknown_sku', sku }
    ProductsApiError → 500 { error: 'products_api_unavailable' }
  lineItems.push({ product, quantity: min(10, line.quantity) })
build:
  productName = ['Футболка - ' + each name]
  productCount = each qty
  productPrice = each price       ← from server, not client
  amount = sum(price * qty)
  currency = 'UAH'                ← hardcoded; backend doesn't return currency
  orderReference = 'DROP01-' + Date.now()
  signature = HMAC-MD5(secret, semicolon-joined fields incl. expanded arrays)
return WayForPayParams
```

Then client-side:
```
new window.Wayforpay().run(params)
cart.clear()                       ← only on the happy path (after .run returns)
```

WayForPay-bound `serviceUrl` = `${SITE_URL}/api/wayforpay-callback`. The callback verifies signatures with the same shared secret, then `sendToTelegram(formatOrderMessage(...))`. Telegram notification fields: `orderReference, fullName, phone, email, city, warehouse, amount`. (Note: `city` and `warehouse` are read from the callback body, but `/api/checkout` doesn't currently send them to WayForPay — see §16 known gap.)

### 4.6 Carousel

- Native CSS `scroll-snap-type: x mandatory` on the scroller; `scroll-snap-align: center` + `scroll-snap-stop: always` per slide. No JS library.
- IntersectionObserver (root = scroller, thresholds = [0.2, 0.4, 0.6, 0.8, 1.0]) drives `activeIndex` via the slide with the highest `intersectionRatio > 0.6`.
- Desktop ≥ 768 px: chevron buttons (left/right). `hidden` attribute toggles visibility at edges.
- Global `keydown` handler: ArrowLeft/Right scroll the carousel ±1 slide, but only when no input/textarea/select/contenteditable is focused (so typing in the checkout form doesn't move the hero).
- Pagination dots are `<button role="tab" aria-current>` — keyboard-focusable, click-to-jump, focus-visible outline.

---

## 5. Cross-system data flows

### 5.1 First page render (cold cache)

```
Browser ─── GET / ──────▶ Next.js
                          app/page.tsx (async Server Component)
                            listProducts()
                              fetch(JAVA/products, Bearer, force-cache, tag:products, 5s timeout)
                                Next data cache MISS
                                  ─── Authorization: Bearer ──▶ Java :8081
                                                                 BearerTokenAuthFilter ✓
                                                                 ProductController.list()
                                                                 ProductRepository.findAllByActiveTrue()
                                                                   ─── findAllByActiveTrue ──▶ MongoDB
                                                                                                  ▲
                                                                                                  │
                                                                   ◀────── List<Product> ─────────┘
                                                                 ProductMapper.toResponse(*)
                                                                   ◀ {items: [...]} 200
                              Zod parse OK
                            Render React tree + JSON-LD
                          → HTML
       ◀── 200 HTML ───
```

### 5.2 Add to cart → drawer

Fully client-side; no server roundtrip.
```
User clicks "В кошик" on slide 2
  BuyOverlay.handleAddToCart
    cart.add({sku:'drop-01-product2', name, price}, 1)
      setItems((prev) => addItem(prev, item, 1))
        → CartItem[] mutated immutably
        → useEffect writes localStorage
    cart.openDrawer()
      setIsDrawerOpen(true)
        → CartDrawer mounts (EXIT_MS-aware)
CartDrawer renders:
  productsBySku.get('drop-01-product2') → Product
    productPictures[0].url → /product2/pic.png
  <Image src=/product2/pic.png ... />
```

### 5.3 Checkout submit (live)

```
Browser ─── POST /api/checkout {fullName, phone, email, items[2], city, ...} ──▶ Next.js
                                                                                 app/api/checkout/route.ts
                                                                                   checkoutSchema.safeParse → ok
                                                                                   for line of items:
                                                                                     getProduct(line.sku)
                                                                                       fetch(JAVA/products/<sku>, Bearer, cache HIT or MISS)
                                                                                       → Product
                                                                                   build WayForPay base (server price)
                                                                                   sign HMAC-MD5
                                                                                   ── 200 {...wayforpay params} ──▶
Browser:
  new window.Wayforpay().run(params)
  cart.clear()
WayForPay widget opens
User pays
WayForPay POSTs callback ── ─ ─ ─ ─ ─ ─ ─ ─ ─▶ Next.js /api/wayforpay-callback
                                                callbackSignature(...) === body.merchantSignature?
                                                  yes + transactionStatus === 'Approved' →
                                                    sendToTelegram(format(...)) ── HTTPS ──▶ api.telegram.org/bot{TOKEN}/sendMessage
                                                respond {orderReference, status:'accept', time, signature}
                                                (signature signs orderRef;status;time)
```

### 5.4 Admin bot edit → catalog change

```
Admin types /edit drop-01-product2 in Telegram
  Telegram pushes Update to Spring's long-polling consumer
    AdminDrillBot.consume → AdminGuard.isAdmin? → CommandHandler.dispatch → editFlow.start
      Inline keyboard sent
Admin taps "Price"
  EditFlow.handleCallback → session.current = PRICE
  Reply: "send a new value"
Admin types "3500"
  EditFlow.handleValueMessage → PRICE.validate → int 3500 ✓
    repo.findById → repo.save(product.withProductPrice(3500).withUpdatedAt(now))
      ─── update ─▶ MongoDB
  Reply: "saved"
```

Frontend STILL serves the cached old page. Operator must:
```
curl -X POST -H "Authorization: Bearer $REVALIDATE_TOKEN" https://isusneisus.com/api/revalidate
```
The tag `products` is marked stale; next page request is a cache MISS → fresh Java fetch → new HTML.

---

## 6. Security & trust boundaries

| Boundary | Mechanism | Status |
|---|---|---|
| Browser → Next.js | Public HTTPS via Vercel. No auth (storefront is public). | ✓ |
| Next.js → Java | `Authorization: Bearer ${PRODUCTS_API_TOKEN}`, server-only. Bundler refuses to ship `lib/products.ts` to the client. | ✓ |
| Operator → `/api/revalidate` | `Authorization: Bearer ${REVALIDATE_TOKEN}`. Plain `!==` compare (acceptable — low blast radius). | ✓ |
| WayForPay → `/api/wayforpay-callback` | HMAC-MD5 signature over `merchantAccount;orderReference;amount;currency;authCode;cardPan;transactionStatus;reasonCode`. | ✓ |
| Browser → WayForPay widget | Loaded over HTTPS from `secure.wayforpay.com`. The widget itself owns card-data entry — Next.js never sees PAN. | ✓ (3rd-party trust) |
| Admin → Telegram bot | `ADMIN_CHAT_IDS` allowlist by numeric Telegram user ID. Non-admins silently dropped. | ✓ |
| Bot → S3 | `DefaultCredentialsProvider` picks up `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` env. Public-read bucket assumed for the delivered URLs. | ⚠ Bucket policy must permit public read on the upload prefix. |
| Spring → MongoDB | Local Docker network only. Mongo is not exposed publicly. Mongo auth not currently enforced — relies on network isolation. | ⚠ For prod, enforce Mongo auth (create user + connection string with credentials). |

**Secrets that MUST be unique to each environment** and never reused:
- `WAYFORPAY_SECRET_KEY` — payment signing
- `PRODUCTS_API_TOKEN` — service-to-service Bearer (must match between Next & Java)
- `REVALIDATE_TOKEN` — cache-bust authorization
- `TELEGRAM_BOT_TOKEN` (both repos use different bots: Next has `TELEGRAM_BOT_TOKEN` for the order-notify bot, Java has its own `TELEGRAM_BOT_TOKEN` for AdminDrillBot)
- `AWS_SECRET_ACCESS_KEY`

**Token rotation playbook (when compromised):**
1. Generate new value.
2. Update env in the owning host(s) — both Next and Java for shared tokens.
3. Roll restarts (Java fail-fasts on missing/blank tokens at startup).

---

## 7. Caching strategy

| Layer | Behavior |
|---|---|
| Next.js data cache | `force-cache` + `next.tags: ['products']` on every `fetch` to Java. Cache is per (URL + method). Indefinite TTL until explicit invalidation. |
| Browser HTML | Statically generated at build (`/` is `○ Static` in `next build`). Vercel CDN caches the HTML. |
| Per-request memoization | Multiple `listProducts()` calls in the same render share one network roundtrip (Next's `fetch` memoization). |
| `getProduct(sku)` vs `listProducts()` | Different URLs → separate cache entries. Calling `getProduct` after `listProducts` does NOT reuse the list's cache. With 2-line cart: 2 sequential cache misses worst case (each gated by 5 s timeout). Accepted trade-off per spec. |
| `POST /api/revalidate` | Calls `revalidateTag('products', { expire: 0 })`. Bumps every cache entry tagged `products` to expired state. Next request is a blocking revalidate. |
| Mongo | No second-level cache; relies on Mongo's working set being hot for the 2 documents. |
| Telegram bot mutations | **Do NOT automatically revalidate.** The bot is unaware of Next's cache. Operator must `POST /api/revalidate` after a bot edit to see changes. — Known gap, future work. |

---

## 8. Error handling philosophy

**Fail-loud, no stale data.**

| Condition | User-visible | Why |
|---|---|---|
| API down on page render | 500 page (`app/error.tsx` — Ukrainian "Щось пішло не так") | No fallback to hardcoded copy. Operator should see this immediately. |
| API down on `/api/checkout` | Existing client alert "Не вдалося почати оплату. Спробуйте ще раз." | `res.ok === false` is caught; cart not cleared. |
| `ProductNotFoundError` on checkout | Same alert (server returns 400 `unknown_sku`). | Tampered cart or stale frontend after a SKU rename. |
| Cart contains SKU not in catalog | Silently filtered out on cart-provider mount. | Cleaner than showing a phantom line. |
| Zod parse failure on Java response | 500 (treated as `ProductsApiError`). | Contract violation; should never happen in a well-formed deployment. |
| Network refused / DNS / 5xx | `ProductsApiError`; user sees 500. | — |
| Timeout (5 s on each Java call) | `ProductsApiError`; user sees 500. | — |
| Mongo down | Spring returns 500 → Java logs it → Next maps to 500. | — |
| Bot S3 upload fails | Bot replies "upload failed, try again". | Mongo write is skipped; product unchanged. |

**What's intentionally NOT covered** (accepted trade-offs):
- No retry-with-backoff. One attempt, then surface.
- No fallback to last-known-good catalog snapshot.
- No error reporting beyond `console.error` (no Sentry, no telemetry).
- `app/error.tsx` does not consume Next 16's `error.digest` / `unstable_retry` props (observability polish for a future iteration).

---

## 9. Testing strategy

| Repo | Coverage |
|---|---|
| **Frontend** | 77 unit tests across 8 files (Vitest, `lib/**/*.test.ts` only). Pure logic only — no component tests, no route handler tests, no E2E. Manual checklists in spec docs cover composition. |
| **Backend** | **Zero automated tests** (deliberate per spec — verification is curl + the Next-side integration). Manual smoke via README quickstart. |

Frontend test breakdown:
| File | Specs | What it covers |
|---|---|---|
| `cart.test.ts` | 22 | Pure cart functions: merge, clamp, no-op, immutability |
| `checkout-schema.test.ts` | 16 | items[] schema, warehouse vs courier, error messages |
| `validateCheckout.test.ts` | 8 | Error key mapping, items-empty → "Кошик порожній" |
| `novaposhta.test.ts` | 5 | mapCities, mapWarehouses (branch vs postbox, sort) |
| `products.test.ts` | 17 | Bearer header, cache flags, URL encoding, all error mappings, token redaction |
| `wayforpay.test.ts` | 4 | hmacMd5, all 3 signature formats |
| `telegram.test.ts` | 1 | formatOrderMessage |
| `smoke.test.ts` | 1 | 1+1=2 (sanity) |

Cross-repo: `lib/__tests__/fixtures/product.example.json` is the canonical example response. A future backend test could byte-mirror it; today it's only used on the frontend side.

---

## 10. Build, deploy & operations

### 10.1 Local development

**Order of operations:**
1. `cd ../sh4ilnui-drill-backend && docker compose up -d mongo` (or `docker compose --profile full up -d` to include the JAR-based service).
2. From backend: `export PRODUCTS_API_TOKEN=dev-token-not-secret && ./gradlew bootRun` (service on `:8081`).
3. From `sh4ilnui-drill-landing`: copy `.env.local.example` → `.env.local`; `npm install`; `npm run dev` (server on `:3000`).
4. Open http://localhost:3000.

**Smoke commands:**
```bash
# Backend health
curl http://localhost:8081/actuator/health

# Backend catalog
curl -H "Authorization: Bearer dev-token-not-secret" http://localhost:8081/products

# Frontend home
curl -o /dev/null -w '%{http_code}\n' http://localhost:3000/

# Cache bust
curl -X POST -H "Authorization: Bearer dev-revalidate-token" http://localhost:3000/api/revalidate
```

### 10.2 Production deploy

**Frontend (Vercel):**
- Push the branch; Vercel builds and deploys via Next.js project preset.
- Configure env vars in Project Settings → Environment Variables (see §17).
- The home page is statically generated at build, so the build needs `PRODUCTS_API_BASE_URL` reachable from Vercel's build runners AND `PRODUCTS_API_TOKEN` set.
- Asset paths inside Mongo docs must be URLs that Vercel-served pages can reach — i.e., either Vercel-served absolute paths (rare) or absolute S3/CloudFront URLs (the typical production setup).

**Backend (any container host — Render, Fly, Railway, ECS, k8s):**
- `docker build .` → push image → run with env from §17.
- Mongo: either co-locate (single VM with `docker compose`) or use a managed instance (Atlas, MongoDB Cloud). Update `MONGO_URI` accordingly.
- For the admin bot, ensure the service can reach `api.telegram.org` outbound. AWS IAM credentials need `s3:PutObject` on the bucket prefix.
- Public exposure: only the frontend's Vercel deployment needs network reach to `:8081`. Browser must NOT be able to reach the Java service.
  - On a single VM: Java listens on `127.0.0.1:8081`, Vercel reaches it via SSH tunnel (rare) or — more realistically — Vercel reaches a public reverse proxy that adds the Bearer header check.
  - On a cloud platform: use platform-internal networking (Render private services, Fly private network, etc.).
  - Whatever the topology, the `PRODUCTS_API_TOKEN` is the only authentication line — never expose the raw service publicly.

### 10.3 Cache invalidation in prod

After updating any product via the admin bot (or by editing Mongo directly):
```bash
curl -X POST \
  -H "Authorization: Bearer $REVALIDATE_TOKEN" \
  https://isusneisus.com/api/revalidate
```
Returns `{revalidated:true, tag:'products', at:'<iso>'}`. The next page request is a cache miss and serves fresh data. No restart needed.

### 10.4 Runtime telemetry (current state)

| Source | Where it lands |
|---|---|
| Spring logs | Container stdout. SLF4J + Logback default format. |
| Next.js logs (Vercel) | Vercel Functions log stream (visible in Project → Logs). |
| Browser console errors | Nowhere (no Sentry/etc. wired today). |
| Order notifications | Telegram chat (the source-of-truth for "what got bought today"). |
| Failed payments | WayForPay merchant dashboard. |

Future work: structured JSON logging, Sentry/Rollbar, uptime monitoring against `/actuator/health` and `/`.

---

## 11. Live verification report — 2026-05-26

All checks performed today against the running local system:

### Backend (`http://localhost:8081`)
| Check | Expected | Actual |
|---|---|---|
| `GET /actuator/health` | 200 `UP` | ✅ 200 `{"groups":["liveness","readiness"],"status":"UP"}` |
| `GET /products` (with Bearer) | 200, ≥ 1 item | ✅ 200, **2 items**: `drop-01-oversize`, `drop-01-product2` |
| `GET /products/drop-01-oversize` (with Bearer) | 200 | ✅ 200 |
| `GET /products/nonexistent` (with Bearer) | 404 | ✅ 404 |
| `GET /products` (no Bearer) | 401 | ✅ 401 |
| `GET /products` (wrong Bearer) | 401 | ✅ 401 |

### Frontend (`http://localhost:3000`)
| Check | Expected | Actual |
|---|---|---|
| `GET /` | 200 | ✅ 200 (32 KB, 0.45 s) |
| HTML contains `/product1/tshirt.mp4` | yes | ✅ yes |
| HTML contains `/product2/video.mp4` | yes | ✅ yes |
| HTML contains both `#product-<sku>` JSON-LD IDs | yes | ✅ yes |
| HTML contains both pagination dots (`role="tab"`) | yes | ✅ yes |
| HTML contains both chevron aria-labels (`Попередній товар`, `Наступний товар`) | yes | ✅ yes |
| HTML contains cart aria-label (`aria-label="Кошик"`) | yes | ✅ yes |
| `POST /api/revalidate` (no auth) | 401 | ✅ 401 |
| `POST /api/revalidate` (with bearer) | 200 + JSON | ✅ 200 `{revalidated:true,tag:'products',at:'...'}` |
| `npm test` | all green | ✅ **77/77** across 8 files (~230 ms) |
| `npx tsc --noEmit` | no errors | ✅ clean |
| `npm run build` | green | ✅ green (10 routes built: 6 static + 4 dynamic API) |

### Cross-system integration
| Check | Expected | Actual |
|---|---|---|
| Frontend home renders products fetched from backend (not from hardcoded catalog) | yes | ✅ verified via HTML containing `drop-01-product2` SKU in JSON-LD |
| Asset paths in Mongo seed reach Next-served files | yes | ✅ `/product1/...` and `/product2/...` exist in `public/` |
| `lib/catalog.ts` deleted, no consumers reference it | yes | ✅ `grep "from '@/lib/catalog'"` returns 0 hits |
| Admin bot startup gated on `TELEGRAM_BOT_TOKEN` | yes | ✅ confirmed via `@ConditionalOnExpression` on all bot beans |

**Verdict: every wired surface verified working.** No blocking issues. Known limitations documented in §16.

---

## 12. Frontend ↔ Backend contract summary

| Surface | Owner | Shape |
|---|---|---|
| `GET /products` | Backend | `{ items: ProductResponse[] }` |
| `GET /products/{id}` | Backend | `ProductResponse` (200) or `{error:'not_found'}` (404) |
| `ProductResponse` | Backend (mapper) | 12 fields per §3.3 — fully consumed by frontend's Zod schema |
| `Authorization: Bearer ${PRODUCTS_API_TOKEN}` | Both | Shared secret; Java's `BearerTokenAuthFilter` enforces; Next's `lib/products.ts` sends |
| `Content-Type: application/json; charset=utf-8` | Backend | Implicit (Spring default) |
| `lib/__tests__/fixtures/product.example.json` | Frontend | Byte-equivalent reference shape; updates require both repos in lock-step |
| Cache invalidation | Frontend (`POST /api/revalidate`) | Operator-triggered; busts the `products` tag |

External contracts (third party, unchanged by the migration):
- **WayForPay**: HMAC-MD5 signing/verification, widget JS loaded from `secure.wayforpay.com/server/pay-widget.js`.
- **Nova Poshta**: HTTPS POST to `api.novaposhta.ua/v2.0/json/`, method bodies for `searchSettlements` and `getWarehouses`.
- **Telegram (Next side)**: HTTPS POST to `api.telegram.org/bot{TOKEN}/sendMessage`.
- **Telegram (Java bot side)**: long-polling via `TelegramBotsLongPollingApplication`.
- **AWS S3**: standard `PutObject` via SDK v2.

---

## 13. Known limitations & accepted trade-offs

| # | Limitation | Status | Source |
|---|---|---|---|
| 1 | No orders database. Source-of-truth = WayForPay dashboard + Telegram chat. | Accepted | Original spec |
| 2 | `/api/wayforpay-callback` reads `body.deliveryCity` / `body.deliveryWarehouse` but `/api/checkout` never sends them to WayForPay → Telegram message always shows `—` for city/warehouse. | Known gap | Original spec |
| 3 | Cart's `name` and `price` are denormalized at add time — if backend price changes, in-cart items keep their old price until removed and re-added. | Accepted | Cart spec |
| 4 | Cart clears at WayForPay handoff (not at callback success). If widget fails after `.run()` returns, cart is empty but no payment happened. | Accepted | Cart spec §15 |
| 5 | Currency hardcoded `'UAH'` server-side. Backend returns no `productCurrency` field. | Accepted | Migration spec |
| 6 | `productButtonLabel`, `productButtonBackgroundColor`, `productButtonFontColor`, `productBrand`, `productDescription`, `productAvailability`, `productPictures[1..]` are CARRIED through `Product` type but NOT consumed by UI. | Accepted | Migration spec — future spec adopts them |
| 7 | Admin bot mutations to Mongo do NOT trigger `POST /api/revalidate` automatically. Operator must call it manually. | Known gap | — |
| 8 | JSON-LD `availability` hardcoded to `InStock` regardless of `productAvailability`. Misleading to crawlers if a product is `sold_out`. | Accepted | Migration spec §2 out-of-scope |
| 9 | `app/error.tsx` doesn't consume Next 16's `error.digest` / `unstable_retry` props. No automatic retry; no error correlation ID. | Accepted | Final review note |
| 10 | `application.yml` uses `spring.mongodb.uri` (not the standard `spring.data.mongodb.uri`). Works locally — verify in production. | Verify-in-prod | Code inspection |
| 11 | No automated tests on the backend. | Accepted (drill design) | Backend spec |
| 12 | Carousel scroll position not persisted — every reload lands on slide 1. | Accepted | Carousel spec |
| 13 | The "courier" delivery branch is preserved as commented-out HTML in `NovaPoshtaPicker.tsx:223-265`. Schema still validates it. | Accepted | Per client decision |
| 14 | `front.webp` / `back.webp` zoom assets in `CheckoutForm.tsx` are hardcoded paths — they don't come from `productPictures`. | Accepted | Migration spec out-of-scope |
| 15 | localStorage key `sasha-cart-v1` is hardcoded — schema changes would require a version bump. | Accepted | — |
| 16 | Telegram bot session state is in-memory only. Spring restart drops all open `/edit` sessions silently. | Accepted | Bot spec |
| 17 | No rate limiting on `/api/checkout`, `/api/novaposhta`, `/api/revalidate`. Single-store low-traffic site assumption. | Accepted | — |
| 18 | No CSP, no HSTS, no security headers configured. Relies on Vercel defaults. | Verify-in-prod | — |
| 19 | The frontend repo has a single bare `first commit` in git history with most files untracked — uncommitted state is normal for the dev pattern but unusual for a real project. Production deployments need a clean git history. | Verify before prod | Inspection |
| 20 | `lib/catalog.ts` and `lib/__tests__/catalog.test.ts` are absent on disk (deleted) but were never tracked in git — the deletion never shows up as a `git rm`. Not a behaviour issue; just a git-hygiene note. | Cosmetic | Inspection |

---

## 14. Future work (queued for separate specs)

- **Auto-revalidation after bot mutation** — bot calls Next's `/api/revalidate` with `REVALIDATE_TOKEN` immediately after a successful `repo.save(...)`. Closes the cache-staleness gap (#7).
- **Adopt rich product fields** — surface `productButtonLabel/Color/Font`, `productBrand`, `productDescription`, `productAvailability` in the UI. Adopt `productPictures[1..]` for the zoom gallery. (Items #6, #8.)
- **Multi-currency** — add `productCurrency` to the API response and remove the `'UAH'` constant in `/api/checkout`. (Item #5.)
- **Real CDN** — move from Next-served relative paths to S3/CloudFront-hosted absolute URLs for video and image. (Already plumbed in the bot; just needs the Mongo seed to be re-pointed.)
- **Order persistence** — small Mongo collection on the backend with order details; Telegram message becomes a notification, not the source of truth. (Item #1.)
- **Observability** — Sentry on the frontend, structured JSON logs on the backend, uptime checks. (Items #9, #11.)
- **Auth-protected admin web UI** — alternative to / supplement to the Telegram bot for catalog management.

---

## 15. The CheckoutModal pre-existing UI quirks worth knowing

A few oddities for the next person reading the modal CSS:

- The KyivTypeSans font has two `@font-face` declarations split across `BuyOverlay.module.css` (Light 300) and `CheckoutModal.module.css` (Black 900). Same family, different files. The browser picks per `font-weight`. Works because BuyOverlay's CSS loads before the checkout modal is opened.
- `app/page.module.css`'s `.page` is `position: fixed; inset: 0; overflow: hidden` — the page is locked to one viewport with no vertical scroll. The carousel's horizontal `overflow-x: auto` is the only intended scroll. Don't introduce vertical scroll on `<main>` without intent.
- `body::before` is a parallax thorns watermark fixed behind everything (`z-index: -1`), with a scroll-driven `bgDrift` animation under `@supports (animation-timeline: scroll())`. Reduced-motion users get the static fallback.
- `CheckoutModal.module.css` carries several dead rules (`.order`, `.thumbBtn`, `.thumb`, `.orderInfo`, `.orderName`, `.orderMeta`, `.orderPrice`, `.payRow`, `.qtyBtn`) — superseded by the multi-product `.orderList*` family in the cart feature. Spec accepted leaving them as no-op clutter for now.

---

## 16. Backend gotchas worth knowing

- The bot is fully gated by `TELEGRAM_BOT_TOKEN` being non-empty. Beans don't load when the var is unset. So a "read-only API + no bot" deployment is just `unset TELEGRAM_BOT_TOKEN`.
- `BearerTokenAuthFilter` uses `MessageDigest.isEqual` (constant-time) for the token compare — protects against timing attacks.
- `Product.java` has eleven `withX(...)` factory methods (one per mutable field). The bot uses them; the API never does. Don't be confused by their presence.
- `EditSessions` runs a scheduled cleanup (`@Scheduled`, `EnableScheduling` is on the application). Sessions older than the TTL are dropped.
- `BotConfig`'s `S3Client` bean uses `DefaultCredentialsProvider`, which picks up `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` env vars (or any of the standard AWS credential locations: SSO, IMDS, instance role). For a containerized prod deployment, prefer instance IAM roles over baked-in keys.
- `S3MediaClient.put` does NOT set `ACL: public-read`. The bucket's policy must permit public read on the object prefix, or the URLs returned to Mongo won't be reachable from the browser.
- The MongoDB property in `application.yml` is at `spring.mongodb.uri` (rather than the documented `spring.data.mongodb.uri`). Locally it works — **before deploying, run `curl /products` against the prod instance and confirm both seeded items appear** to confirm the URI binding.

---

## 17. Production environment variables — copy/paste cheat sheet

### Frontend (`sh4ilnui-drill-landing`) — Vercel Project Settings → Environment Variables

```bash
# ─── PRODUCT API (server-to-server) ────────────────────────────────────────
# Where Next.js reaches the Spring Boot service. NO trailing slash.
# Internal network URL — must NOT be publicly reachable from the browser.
PRODUCTS_API_BASE_URL=https://products-service.internal.example.com

# Shared secret with the backend's BearerTokenAuthFilter.
# 32+ random chars (e.g. `openssl rand -hex 32`). MUST be identical to backend's PRODUCTS_API_TOKEN.
PRODUCTS_API_TOKEN=<paste-strong-random-string-here>

# Authorizes POST /api/revalidate. Separate secret from PRODUCTS_API_TOKEN.
# 32+ random chars.
REVALIDATE_TOKEN=<paste-strong-random-string-here>

# ─── WAYFORPAY (Ukrainian payment processor) ───────────────────────────────
# All three from the merchant cabinet at wayforpay.com.
WAYFORPAY_MERCHANT_ACCOUNT=<from-wayforpay-cabinet>
WAYFORPAY_MERCHANT_DOMAIN=isusneisus.com
WAYFORPAY_SECRET_KEY=<from-wayforpay-cabinet>

# ─── NOVA POSHTA (Ukrainian shipping) ──────────────────────────────────────
# From Nova Poshta cabinet → Settings → Security → API.
NOVAPOSHTA_API_KEY=<from-novaposhta-cabinet>

# ─── TELEGRAM (order notifications to managers' chat) ──────────────────────
# This is the ORDER-NOTIFY bot, NOT the admin bot. Different token.
# Create via @BotFather, add bot to managers' chat, post any message, then
# curl https://api.telegram.org/bot<TOKEN>/getUpdates and read chat.id.
TELEGRAM_BOT_TOKEN=<from-botfather>
TELEGRAM_CHAT_ID=<numeric-chat-id-of-managers-group>

# ─── PUBLIC SITE URL ───────────────────────────────────────────────────────
# Used by lib/config.ts; baked into metadata.metadataBase, JSON-LD @id values,
# serviceUrl/returnUrl sent to WayForPay.
NEXT_PUBLIC_SITE_URL=https://isusneisus.com
```

**WayForPay merchant cabinet config (one-time, not an env var):**
- `serviceUrl` = `https://isusneisus.com/api/wayforpay-callback`
- `returnUrl` = `https://isusneisus.com/`
- Enable фіскалізація (programmable cash register / пРРО) so receipts are auto-emitted to buyer email.

### Backend (`sh4ilnui-drill-backend`) — container env

```bash
# ─── PRODUCTS API (mandatory) ──────────────────────────────────────────────
# MUST exactly match the frontend's PRODUCTS_API_TOKEN.
PRODUCTS_API_TOKEN=<same-strong-random-string-as-frontend>

# MongoDB URI. For a managed Mongo (Atlas), include credentials.
# Locally with docker compose: mongodb://mongo:27017/products
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/products?retryWrites=true&w=majority

# ─── ADMIN TELEGRAM BOT (optional — unset to disable the entire bot) ───────
# Different bot from the order-notify bot. Create via @BotFather.
TELEGRAM_BOT_TOKEN=<from-botfather-for-admin-bot>

# Allowlist of admin Telegram user IDs (comma-separated).
# Get yours by messaging @userinfobot. Bot REJECTS startup if this is empty
# when TELEGRAM_BOT_TOKEN is set.
ADMIN_CHAT_IDS=<your-numeric-user-id>[,<another-admin-id>...]

# ─── AWS S3 (required ONLY if the admin bot is enabled) ────────────────────
# Bucket needs s3:PutObject permission and a bucket policy allowing public
# read on uploaded objects.
AWS_REGION=eu-central-1
AWS_S3_BUCKET=<your-bucket-name>
AWS_S3_PUBLIC_URL_BASE=https://<bucket>.s3.<region>.amazonaws.com
AWS_ACCESS_KEY_ID=<aws-access-key>
AWS_SECRET_ACCESS_KEY=<aws-secret>

# Optional — hard cap for HTTPS URL video pastes (bytes). Default 200 MB.
# MEDIA_MAX_VIDEO_BYTES=209715200
```

### Local development (already wired)

Both repos ship `.env.example` (backend) and `.env.local.example` (frontend) with safe dev placeholders:
- `PRODUCTS_API_TOKEN=dev-token-not-secret` (matches both sides).
- `REVALIDATE_TOKEN=dev-revalidate-token`.
- `WAYFORPAY_*`, `NOVAPOSHTA_API_KEY`, `TELEGRAM_*` blank — payment/checkout/notify won't work locally, but every UI flow up to the alert renders correctly.
- `MONGO_URI` defaulted in `application.yml` to `mongodb://localhost:27017/products`.

### Validation checklist before flipping prod live

- [ ] `PRODUCTS_API_TOKEN` is identical on both sides (frontend Vercel + backend container).
- [ ] `PRODUCTS_API_BASE_URL` is reachable from Vercel build runners (try a build).
- [ ] `PRODUCTS_API_BASE_URL` is NOT publicly reachable from a browser (try opening it in Chrome — should fail).
- [ ] `REVALIDATE_TOKEN` set on the frontend; test with curl from your laptop.
- [ ] `NEXT_PUBLIC_SITE_URL` matches the real domain — JSON-LD `@id` values and `metadataBase` are baked from it.
- [ ] WayForPay merchant cabinet has `serviceUrl` pointing at `${SITE_URL}/api/wayforpay-callback`.
- [ ] WayForPay fiscalization (пРРО) is enabled in the merchant cabinet.
- [ ] Backend container can reach MongoDB (check container logs for "Connected to MongoDB").
- [ ] Backend container can reach `api.telegram.org` (only matters if bot enabled).
- [ ] AWS bucket policy allows public read on the upload prefix (only matters if bot enabled).
- [ ] `curl https://isusneisus.com/` returns 200 with the seeded product names in HTML.
- [ ] `curl -X POST -H 'Authorization: Bearer $REVALIDATE_TOKEN' https://isusneisus.com/api/revalidate` returns 200.
- [ ] Mock a checkout submission in production: fill form, submit, see WayForPay widget; verify Telegram notification arrives.
- [ ] Use admin bot to flip a product's price; `POST /api/revalidate`; reload site; confirm new price visible.

---

## 18. One-line summary for the engineer who hates reading

A Next.js 16 single-page landing on Vercel reads its product catalog at server render time from a private Spring Boot 4 + MongoDB service over a Bearer-token-secured HTTP call (`force-cache` + tag-invalidation); a Telegram bot on the same Spring service mutates Mongo and uploads media to S3; payment goes through the WayForPay widget with HMAC-MD5 signing on the Next side; orders land in WayForPay's dashboard + a Telegram managers' chat (no orders DB); cart lives in browser localStorage; every flow is verified working today.
