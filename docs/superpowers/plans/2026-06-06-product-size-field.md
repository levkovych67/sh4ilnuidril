# Product Size Field — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each product carry a free-form list of sizes (or be "one size"), require the customer to pick a size before buying a sized product, keep that size distinct through the cart, and carry it into the order (WayForPay + the manager Telegram alert).

**Architecture:** A new `productSizes: List<String>` flows from the Mongo `Product` → REST `ProductResponse` → frontend Zod `Product` → a size-pill selector in `BuyOverlay` → the cart line (whose identity becomes `productId + size`) → the checkout payload → WayForPay `productName` (size embedded) → the WayForPay callback → the Telegram order message. Empty list ⇒ one-size (no selector, buys directly). Stock stays product-level (`productAvailability` unchanged).

**Tech stack:** Backend = Spring Boot 4 / Java 21 (Gradle, **no unit-test framework — verify by `bootRun` + curl/bot**). Frontend = Next.js 16 / React 19 / TypeScript / Zod, with **Vitest** for `lib/` logic (use TDD there).

**Two repos (separate git roots):**
- Backend: `/Users/bohdanlevkovych/Desktop/development/sh4ilnui drill/sh4ilnui-drill-backend`
- Frontend: `/Users/bohdanlevkovych/Desktop/development/sh4ilnui drill/sh4ilnui-drill-landing`

**Decisions (locked with the user):** free-form sizes per product · product-level stock only · size selection required before buying · the manager Telegram alert is upgraded to show the real ordered items + sizes (replacing its current hardcoded placeholder).

**Data contract:**
| Layer | Shape |
|---|---|
| Mongo `Product` record | `List<String> productSizes` (after `productBrand`); legacy docs deserialize to `null` ⇒ must null-guard |
| `ProductResponse` (API) | `"productSizes": ["S","M","L"]` — always present, `[]` for one-size |
| Frontend `ProductSchema` | `productSizes: z.array(z.string()).default([])` |
| `CartItem` | add `size: string` (`""` = one-size); **line identity = `lineKey = ${sku}__${size}`** |
| Checkout line | `{ sku, size, quantity }` |
| WayForPay `productName[i]` | `Футболка - <name> (Розмір: <size>)` (omit the suffix when one-size) |

---

## File Structure

**Backend (modify):**
- `src/main/java/com/isusneisus/products/domain/Product.java` — add record component + `withProductSizes` + thread through all `with*`
- `src/main/java/com/isusneisus/products/bot/ProductDefaults.java` — default `List.of()`
- `src/main/java/com/isusneisus/products/api/ProductResponse.java` — add field
- `src/main/java/com/isusneisus/products/api/ProductMapper.java` — map + null-coalesce
- `src/main/java/com/isusneisus/products/bot/edit/EditField.java` — `SIZES` editor field
- `src/main/java/com/isusneisus/products/bot/Replies.java` — keyboard button + card line
- `mongo-init.js` — seed both docs
- `docs/API.md` — document the field

**Frontend (modify unless noted):**
- `lib/products.ts` — Zod schema
- `lib/cart.ts` — `CartItem.size`, `lineKey`, identity-aware ops
- `lib/__tests__/cart.test.ts` — size-aware fixtures + distinctness tests
- `components/Cart/CartProvider.tsx` — guard, storage-key bump, signatures
- `components/Cart/CartDrawer.tsx` — composite key, `lineKey` handles, show size
- `components/BuyOverlay/BuyOverlay.tsx` — size-pill selector + gating
- `components/BuyOverlay/BuyOverlay.module.css` — pill styles (append)
- `components/Checkout/CheckoutForm.tsx` — payload size, composite key, show size
- `lib/checkoutSchema.ts` — `size` on line schema
- `lib/__tests__/checkout-schema.test.ts`, `lib/__tests__/validateCheckout.test.ts` — fixtures
- `app/api/checkout/route.ts` — thread size into WayForPay `productName`
- `app/api/wayforpay-callback/route.ts` — parse items+sizes from callback
- `lib/telegram.ts` — render real items+sizes in the order message

**Explicitly NOT touched:** `lib/catalog.ts` (dead code — unused static catalog; flagged, not edited). `lib/wayforpay.ts` signature logic (size rides inside the already-signed `productName`, so no signature change).

---

# Phase 1 — Backend domain & API

> No backend test framework. Each task's verification is a compile and/or a `curl`. Run the backend with the bot enabled exactly as it runs today:
> ```bash
> cd "/Users/bohdanlevkovych/Desktop/development/sh4ilnui drill/sh4ilnui-drill-backend"
> set -a; . ./.env; set +a
> export PRODUCTS_API_TOKEN="$(grep -E '^PRODUCTS_API_TOKEN=' "/Users/bohdanlevkovych/Desktop/development/sh4ilnui drill/sh4ilnui-drill-landing/.env.local" | cut -d= -f2-)"
> ./gradlew bootRun
> ```
> Auth header for curl: `TOKEN="$(grep -E '^PRODUCTS_API_TOKEN=' "/Users/bohdanlevkovych/Desktop/development/sh4ilnui drill/sh4ilnui-drill-landing/.env.local" | cut -d= -f2-)"`

### Task 1.1: Add `productSizes` to the `Product` record

**Files:** Modify `src/main/java/com/isusneisus/products/domain/Product.java`

- [ ] **Step 1: Add the record component.** In the record header, insert a line immediately **after** `String productBrand,`:

```java
    List<ProductPicture> productPictures,
    String productBrand,
    List<String> productSizes,
    ProductAvailability productAvailability,
```

(The file already has `import java.util.List;`.)

- [ ] **Step 2: Thread it through every `with*` method.** Each `with*` method calls `new Product(...)` listing all components positionally. In **every one of the 13** methods (`withProductName`, `withProductDescription`, `withProductPrice`, `withProductVideoUrl`, `withProductVideoPosterUrl`, `withProductPictures`, `withProductBrand`, `withProductAvailability`, `withProductButtonLabel`, `withProductButtonBackgroundColor`, `withProductButtonFontColor`, `withActive`, `withDraft`, `withUpdatedAt`), insert `productSizes,` immediately after the `productBrand,` argument. Worked example — `withProductName` becomes:

```java
    public Product withProductName(String v) {
        return new Product(id, v, productDescription, productPrice, productVideoUrl,
            productVideoPosterUrl, productPictures, productBrand, productSizes, productAvailability,
            productButtonLabel, productButtonBackgroundColor, productButtonFontColor,
            active, draft, createdAt, updatedAt);
    }
```

- [ ] **Step 3: Add the dedicated mutator** (place it next to `withProductBrand`):

```java
    public Product withProductSizes(List<String> v) {
        return new Product(id, productName, productDescription, productPrice, productVideoUrl,
            productVideoPosterUrl, productPictures, productBrand, v, productAvailability,
            productButtonLabel, productButtonBackgroundColor, productButtonFontColor,
            active, draft, createdAt, updatedAt);
    }
```

- [ ] **Step 4: Compile (this is the safety net for the positional edits).**

Run:
```bash
cd "/Users/bohdanlevkovych/Desktop/development/sh4ilnui drill/sh4ilnui-drill-backend" && ./gradlew compileJava --console=plain 2>&1 | tail -5
```
Expected: `BUILD SUCCESSFUL`. A misplaced argument typically fails here with an arity/type error — fix before moving on.

### Task 1.2: Default `productSizes` for new drafts

**Files:** Modify `src/main/java/com/isusneisus/products/bot/ProductDefaults.java`

- [ ] **Step 1: Insert the default** between the `productBrand` and `productAvailability` arguments of the `new Product(...)` call:

```java
            "",                              // productBrand
            List.<String>of(),               // productSizes
            ProductAvailability.IN_STOCK,    // productAvailability
```

(The file already imports `java.util.List`.)

- [ ] **Step 2: Compile.** Run: `./gradlew compileJava --console=plain 2>&1 | tail -3` — expected `BUILD SUCCESSFUL`.

### Task 1.3: Expose `productSizes` in the API DTO

**Files:** Modify `src/main/java/com/isusneisus/products/api/ProductResponse.java`, `src/main/java/com/isusneisus/products/api/ProductMapper.java`

- [ ] **Step 1: Add the field to `ProductResponse`** after `String productBrand,`:

```java
    List<ProductPictureResponse> productPictures,
    String productBrand,
    List<String> productSizes,
    String productAvailability,
```

- [ ] **Step 2: Map it (null-coalescing legacy docs) in `ProductMapper.toResponse`.** Add a local above the `return`, mirroring the existing `pics` guard, and pass it in the new position:

```java
        List<ProductPicture> pics = p.productPictures() == null ? List.of() : p.productPictures();
        List<String> sizes = p.productSizes() == null ? List.of() : p.productSizes();
        return new ProductResponse(
            p.id(),
            p.productName(),
            p.productDescription(),
            p.productPrice(),
            p.productVideoUrl(),
            p.productVideoPosterUrl(),
            pics.stream()
                .map(pic -> new ProductPictureResponse(pic.url(), pic.alt()))
                .toList(),
            p.productBrand(),
            sizes,
            switch (p.productAvailability()) {
                case IN_STOCK -> "in_stock";
                case SOLD_OUT -> "sold_out";
            },
            p.productButtonLabel(),
            p.productButtonBackgroundColor(),
            p.productButtonFontColor()
        );
```

- [ ] **Step 3: Compile + run + verify legacy docs return `[]`.**

```bash
./gradlew bootRun   # in a dedicated shell, env loaded as shown above
# then, in another shell:
TOKEN="$(grep -E '^PRODUCTS_API_TOKEN=' "/Users/bohdanlevkovych/Desktop/development/sh4ilnui drill/sh4ilnui-drill-landing/.env.local" | cut -d= -f2-)"
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8081/products | python3 -c 'import sys,json;[print(p["productId"], p["productSizes"]) for p in json.load(sys.stdin)["items"]]'
```
Expected: every product prints a `productSizes` value; pre-existing docs (which lack the field) print `[]` (proves the null-guard).

- [ ] **Step 4: Commit.**
```bash
cd "/Users/bohdanlevkovych/Desktop/development/sh4ilnui drill/sh4ilnui-drill-backend"
git add src/main/java/com/isusneisus/products/domain/Product.java src/main/java/com/isusneisus/products/bot/ProductDefaults.java src/main/java/com/isusneisus/products/api/ProductResponse.java src/main/java/com/isusneisus/products/api/ProductMapper.java
git commit -m "feat(size): add productSizes to Product domain + API"
```

### Task 1.4: Seed sizes into the demo products

**Files:** Modify `mongo-init.js`

- [ ] **Step 1:** In the **first** seed doc (`_id: 'drop-01-oversize'`), add a `productSizes` key after `productBrand`:

```js
    productBrand: 'Sasha Chemerov × Димна Суміш',
    productSizes: ['S', 'M', 'L', 'XL'],
    productAvailability: 'IN_STOCK',
```

- [ ] **Step 2:** In the **second** seed doc (`_id: 'drop-01-product2'`), add an empty list (demonstrates one-size) after `productBrand`:

```js
    productBrand: 'Sasha Chemerov × Димна Суміш',
    productSizes: [],
    productAvailability: 'IN_STOCK',
```

- [ ] **Step 3:** (Optional, for an already-running local DB — `mongo-init.js` only runs on a fresh volume.) Backfill existing docs and give the demo product real sizes:
```bash
mongosh --quiet products --eval 'db.products.updateMany({productSizes:{$exists:false}},{$set:{productSizes:[]}}); db.products.updateOne({_id:"drop-01-oversize"},{$set:{productSizes:["S","M","L","XL"]}}); printjson(db.products.find({},{productSizes:1}).toArray())'
```
Expected: each doc now has a `productSizes` array.

- [ ] **Step 4: Commit.** `git add mongo-init.js && git commit -m "chore(size): seed productSizes in demo products"`

### Task 1.5: Document the field

**Files:** Modify `docs/API.md`

- [ ] **Step 1:** In the `ProductResponse` schema/field table and the example JSON body for `GET /products` and `GET /products/{id}`, add:

> `productSizes` — `string[]` — the sizes offered for this product, in display order. An empty array means the product is "one size" (the storefront shows no size selector). Always present.

Add `"productSizes": ["S","M","L","XL"]` to the example response object(s).

- [ ] **Step 2: Commit.** `git add docs/API.md && git commit -m "docs(size): document productSizes in API.md"`

---

# Phase 2 — Backend admin bot (set sizes via `/edit`)

### Task 2.1: Add the `SIZES` editor field

**Files:** Modify `src/main/java/com/isusneisus/products/bot/edit/EditField.java`

- [ ] **Step 1: Add imports** (top of file, with the other `java.util` imports):

```java
import java.util.Arrays;
import java.util.List;
```

- [ ] **Step 2: Add the enum constant.** Place it right after the `BRAND(...)` constant:

```java
    SIZES("Sizes", "Send comma-separated sizes (e.g. S,M,L) or '-' for one size",
        EditField::sizesOrDash,
        (p, v) -> p.withProductSizes(asStringList(v))),
```

- [ ] **Step 3: Add the validator + cast helpers** (next to the other `private static` helpers like `nonBlank`/`urlOrDash`):

```java
    private static Result sizesOrDash(String raw) {
        String t = raw == null ? "" : raw.trim();
        if (t.equals("-")) return Result.ok(List.<String>of());
        List<String> list = Arrays.stream(t.split(","))
            .map(String::trim)
            .filter(s -> !s.isEmpty())
            .distinct()
            .toList();
        return list.isEmpty()
            ? Result.err("send at least one size, or '-' for one size")
            : Result.ok(list);
    }

    @SuppressWarnings("unchecked")
    private static List<String> asStringList(Object v) {
        return (List<String>) v;
    }
```

- [ ] **Step 4: Compile.** `./gradlew compileJava --console=plain 2>&1 | tail -3` → `BUILD SUCCESSFUL`. (The editor reply `"✓ Sizes = " + value` renders a `List` as `[S, M, L]`, which is acceptable.)

### Task 2.2: Surface the field in the edit keyboard + product card

**Files:** Modify `src/main/java/com/isusneisus/products/bot/Replies.java`

- [ ] **Step 1: Add the keyboard button.** In `fieldKeyboard()`, extend the Video/Poster/Label row:

```java
        rows.add(row(btn("Video URL", "field:VIDEO_URL"), btn("Poster URL", "field:VIDEO_POSTER_URL"),
                     btn("Label", "field:BUTTON_LABEL"), btn("Sizes", "field:SIZES")));
```

- [ ] **Step 2: Show sizes on the product card.** In `productCard(Product p)`, change the brand line (currently ends with two newlines) to a brand line + a sizes line:

```java
        sb.append("🏭 ").append(safe(p.productBrand())).append('\n');
        var sizes = p.productSizes();
        sb.append("📏 ")
          .append(sizes == null || sizes.isEmpty() ? "one size" : String.join(", ", sizes))
          .append('\n').append('\n');
```

- [ ] **Step 3: Restart + verify via the bot.** Restart `bootRun`. In Telegram: `/edit drop-01-oversize` → tap **Sizes** → send `S,M,L`. Then:
```bash
TOKEN="$(grep -E '^PRODUCTS_API_TOKEN=' "/Users/bohdanlevkovych/Desktop/development/sh4ilnui drill/sh4ilnui-drill-landing/.env.local" | cut -d= -f2-)"
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8081/products/drop-01-oversize | python3 -c 'import sys,json;print(json.load(sys.stdin)["productSizes"])'
```
Expected: `['S', 'M', 'L']`. Then send `-` to the Sizes field and re-check → `[]`. `/show drop-01-oversize` shows the `📏` line.

- [ ] **Step 4: Commit.**
```bash
git add src/main/java/com/isusneisus/products/bot/edit/EditField.java src/main/java/com/isusneisus/products/bot/Replies.java
git commit -m "feat(size): admin can set product sizes via the bot"
```

---

# Phase 3 — Frontend contract + size selector

> Frontend git root for all Phase 3-5 commits: `/Users/bohdanlevkovych/Desktop/development/sh4ilnui drill/sh4ilnui-drill-landing`. Run the dev server with `npm run dev` (port 3000). Component changes have no unit tests → verify in the browser; after editing a product's sizes via the bot, bust the storefront cache: `curl -X POST -H "Authorization: Bearer dev-revalidate-token" http://localhost:3000/api/revalidate`.

### Task 3.1: Accept `productSizes` in the product schema

**Files:** Modify `lib/products.ts`

- [ ] **Step 1:** In `ProductSchema`, add the field after `productBrand`:

```ts
  productBrand: z.string(),
  productSizes: z.array(z.string()).default([]),
  productAvailability: z.enum(['in_stock', 'sold_out']),
```

- [ ] **Step 2: Type-check.** Run: `npx tsc --noEmit` → no new errors. (`Product` type now includes `productSizes: string[]`.)

### Task 3.2: Size-pill selector in `BuyOverlay`

**Files:** Modify `components/BuyOverlay/BuyOverlay.tsx`, `components/BuyOverlay/BuyOverlay.module.css`

- [ ] **Step 1: Replace `BuyOverlay.tsx` with the size-aware version:**

```tsx
'use client';

import { useState } from 'react';
import { useCart } from '@/components/Cart/CartProvider';
import { useCheckout } from '@/components/Checkout/CheckoutProvider';
import type { Product } from '@/lib/products';
import styles from './BuyOverlay.module.css';

export function BuyOverlay({ product }: { product: Product }) {
  const { add, openDrawer, closeDrawer, items } = useCart();
  const { open: openCheckout } = useCheckout();

  const sizes = product.productSizes;
  const oneSize = sizes.length === 0;
  const [selectedSize, setSelectedSize] = useState('');
  const size = oneSize ? '' : selectedSize;
  const needsSize = !oneSize && selectedSize === '';

  const hasThisProduct = items.some(
    (i) => i.sku === product.productId && i.size === size,
  );

  function addToCart() {
    add(
      {
        sku: product.productId,
        name: product.productName,
        price: product.productPrice,
        size,
      },
      1,
    );
  }

  function handleBuyNow() {
    if (needsSize) return;
    if (!hasThisProduct) addToCart();
    closeDrawer();
    openCheckout();
  }

  function handleAddToCart() {
    if (needsSize) return;
    addToCart();
    openDrawer();
  }

  return (
    <div className={styles.overlay}>
      {!oneSize && (
        <div className={styles.sizes} role="group" aria-label="Розмір">
          {sizes.map((s) => (
            <button
              key={s}
              type="button"
              className={styles.sizePill}
              data-selected={s === selectedSize ? 'true' : undefined}
              aria-pressed={s === selectedSize}
              onClick={() => setSelectedSize(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <div className={styles.buttons}>
        <button
          type="button"
          className={styles.buyPrimary}
          onClick={handleBuyNow}
          disabled={needsSize}
          aria-disabled={needsSize}
        >
          Забрати
        </button>
        <button
          type="button"
          className={styles.buySecondary}
          onClick={handleAddToCart}
          disabled={needsSize}
          aria-disabled={needsSize}
        >
          В кошик
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Append pill styles** to `components/BuyOverlay/BuyOverlay.module.css`:

```css
.sizes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  margin-bottom: 12px;
}

.sizePill {
  min-width: 44px;
  padding: 8px 12px;
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.35);
  color: #fafafa;
  font: inherit;
  cursor: pointer;
}

.sizePill[data-selected='true'] {
  background: #fafafa;
  color: #000;
  border-color: #fafafa;
}
```

- [ ] **Step 3: Verify in browser.** Ensure `drop-01-oversize` has sizes (Task 2.3) and revalidate. Open `http://localhost:3000`: the sized product shows pills; **Забрати/В кошик are disabled until a pill is selected**; the one-size product (`drop-01-product2`) shows no pills and buys directly.

- [ ] **Step 4: Commit.**
```bash
git add lib/products.ts components/BuyOverlay/BuyOverlay.tsx components/BuyOverlay/BuyOverlay.module.css
git commit -m "feat(size): size-pill selector with required-selection gating"
```

---

# Phase 4 — Cart line identity (`productId + size`)

### Task 4.1: `CartItem.size` + `lineKey` identity (TDD)

**Files:** Modify `lib/cart.ts`; Test `lib/__tests__/cart.test.ts`

- [ ] **Step 1: Write the failing tests.** Replace `lib/__tests__/cart.test.ts` with the size-aware version (adds `size` to fixtures, switches `setQuantity`/`removeItem` to `lineKey`, and adds distinctness cases):

```ts
import { describe, it, expect } from 'vitest';
import {
  addItem,
  setQuantity,
  removeItem,
  totalQuantity,
  totalAmount,
  lineKey,
  MAX_QUANTITY,
  type CartItem,
} from '../cart';

const TEE = { sku: 'DROP01-OVERSIZE', name: 'Tee', price: 2600, size: 'M' };
const TEE_L = { ...TEE, size: 'L' };
const HAT = { sku: 'HAT-01', name: 'Hat', price: 800, size: '' };

function line(p: Omit<CartItem, 'quantity'>, quantity: number): CartItem {
  return { ...p, quantity };
}

describe('addItem', () => {
  it('appends a new line if (sku,size) is not in the cart', () => {
    expect(addItem([], TEE, 1)).toEqual([line(TEE, 1)]);
  });

  it('appends with default qty 1 when qty omitted', () => {
    expect(addItem([], TEE)).toEqual([line(TEE, 1)]);
  });

  it('merges quantity for an existing (sku,size)', () => {
    expect(addItem([line(TEE, 2)], TEE, 3)).toEqual([line(TEE, 5)]);
  });

  it('keeps the same SKU in two sizes as TWO distinct lines', () => {
    const start = addItem([], TEE, 1);
    const both = addItem(start, TEE_L, 1);
    expect(both).toEqual([line(TEE, 1), line(TEE_L, 1)]);
  });

  it('merges only the matching size, leaving the other size untouched', () => {
    const start = [line(TEE, 1), line(TEE_L, 1)];
    expect(addItem(start, TEE_L, 2)).toEqual([line(TEE, 1), line(TEE_L, 3)]);
  });

  it('clamps the merged quantity to MAX_QUANTITY', () => {
    expect(addItem([line(TEE, 8)], TEE, 5)).toEqual([line(TEE, MAX_QUANTITY)]);
  });

  it('clamps an initial add that would exceed MAX_QUANTITY', () => {
    expect(addItem([], TEE, 99)).toEqual([line(TEE, MAX_QUANTITY)]);
  });

  it('does not mutate the input array', () => {
    const start = [line(TEE, 1)];
    addItem(start, TEE, 1);
    expect(start).toEqual([line(TEE, 1)]);
  });

  it('is a no-op when qty is 0 or negative', () => {
    expect(addItem([], TEE, 0)).toEqual([]);
    expect(addItem([line(TEE, 2)], TEE, -5)).toEqual([line(TEE, 2)]);
  });
});

describe('lineKey', () => {
  it('combines sku and size', () => {
    expect(lineKey(TEE)).toBe('DROP01-OVERSIZE__M');
    expect(lineKey(HAT)).toBe('HAT-01__');
  });
});

describe('setQuantity', () => {
  it('updates the targeted (sku,size) line', () => {
    expect(setQuantity([line(TEE, 1)], lineKey(TEE), 4)).toEqual([line(TEE, 4)]);
  });

  it('updates only the matching size line', () => {
    const start = [line(TEE, 1), line(TEE_L, 1)];
    expect(setQuantity(start, lineKey(TEE_L), 4)).toEqual([line(TEE, 1), line(TEE_L, 4)]);
  });

  it('clamps a value above MAX_QUANTITY', () => {
    expect(setQuantity([line(TEE, 1)], lineKey(TEE), 99)).toEqual([line(TEE, MAX_QUANTITY)]);
  });

  it('removes the line when qty <= 0', () => {
    expect(setQuantity([line(TEE, 1)], lineKey(TEE), 0)).toEqual([]);
  });

  it('is a no-op for an unknown line key', () => {
    expect(setQuantity([line(TEE, 1)], 'UNKNOWN__M', 3)).toEqual([line(TEE, 1)]);
  });

  it('does not mutate the input array', () => {
    const start = [line(TEE, 1)];
    setQuantity(start, lineKey(TEE), 4);
    expect(start).toEqual([line(TEE, 1)]);
  });
});

describe('removeItem', () => {
  it('drops only the matching (sku,size) line', () => {
    expect(removeItem([line(TEE, 2), line(TEE_L, 1)], lineKey(TEE))).toEqual([line(TEE_L, 1)]);
  });

  it('is a no-op for an unknown line key', () => {
    expect(removeItem([line(TEE, 1)], 'UNKNOWN__M')).toEqual([line(TEE, 1)]);
  });
});

describe('totals', () => {
  it('totalQuantity sums quantities across lines', () => {
    expect(totalQuantity([line(TEE, 2), line(HAT, 3)])).toBe(5);
  });
  it('totalAmount sums price × quantity across lines', () => {
    expect(totalAmount([line(TEE, 2), line(HAT, 3)])).toBe(2 * 2600 + 3 * 800);
  });
});
```

- [ ] **Step 2: Run the tests; verify they FAIL.** Run: `npx vitest run lib/__tests__/cart.test.ts` — Expected: failures (`lineKey` not exported; `setQuantity`/`removeItem` still keyed by `sku`).

- [ ] **Step 3: Implement `lib/cart.ts`.** Replace the file with:

```ts
export interface CartItem {
  sku: string;
  name: string;
  price: number;
  size: string;
  quantity: number;
}

export const MAX_QUANTITY = 10;

/** Cart line identity: a product in two sizes is two lines. */
export function lineKey(item: { sku: string; size: string }): string {
  return `${item.sku}__${item.size}`;
}

function clampQty(n: number): number {
  if (n > MAX_QUANTITY) return MAX_QUANTITY;
  if (n < 0) return 0;
  return n;
}

export function addItem(
  items: CartItem[],
  item: Omit<CartItem, 'quantity'>,
  qty: number = 1,
): CartItem[] {
  if (qty <= 0) return items;
  const key = lineKey(item);
  const existing = items.find((i) => lineKey(i) === key);
  if (existing) {
    const merged = clampQty(existing.quantity + qty);
    if (merged <= 0) return items;
    return items.map((i) => (lineKey(i) === key ? { ...i, quantity: merged } : i));
  }
  const clamped = clampQty(qty);
  if (clamped <= 0) return items;
  return [...items, { ...item, quantity: clamped }];
}

export function setQuantity(items: CartItem[], key: string, qty: number): CartItem[] {
  const clamped = clampQty(qty);
  if (clamped <= 0) return removeItem(items, key);
  return items.map((i) => (lineKey(i) === key ? { ...i, quantity: clamped } : i));
}

export function removeItem(items: CartItem[], key: string): CartItem[] {
  return items.filter((i) => lineKey(i) !== key);
}

export function totalQuantity(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.quantity, 0);
}

export function totalAmount(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.quantity * i.price, 0);
}
```

- [ ] **Step 4: Run the tests; verify they PASS.** Run: `npx vitest run lib/__tests__/cart.test.ts` → all green.

- [ ] **Step 5: Commit.**
```bash
git add lib/cart.ts lib/__tests__/cart.test.ts
git commit -m "feat(size): cart line identity becomes (sku + size)"
```

### Task 4.2: Wire size through `CartProvider`

**Files:** Modify `components/Cart/CartProvider.tsx`

- [ ] **Step 1: Bump the storage key** (drops legacy size-less carts cleanly):

```ts
const STORAGE_KEY = 'sasha-cart-v2';
```

- [ ] **Step 2: Require `size` in the load guard.** Add one clause to `isCartItem`:

```ts
  return (
    typeof v.sku === 'string' &&
    typeof v.name === 'string' &&
    typeof v.price === 'number' &&
    typeof v.size === 'string' &&
    typeof v.quantity === 'number'
  );
```

- [ ] **Step 3: Re-key `setQty`/`remove` on the line key.** Update the context type and the two callbacks:

```ts
interface CartContextValue {
  items: CartItem[];
  add: (item: Omit<CartItem, 'quantity'>, qty?: number) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  totalQuantity: number;
  totalAmount: number;
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  productsBySku: Map<string, Product>;
}
```

```ts
  const setQty = useCallback(
    (key: string, qty: number) => setItems((prev) => setQuantity(prev, key, qty)),
    [],
  );
  const remove = useCallback(
    (key: string) => setItems((prev) => removeItem(prev, key)),
    [],
  );
```

(`add` is unchanged — its `item` argument now carries `size` via the `CartItem` type. `productsBySku` stays keyed by `productId`. `CartProvider` does **not** import `lineKey`: its `setQty`/`remove` simply forward the key string to `setQuantity`/`removeItem`, which compute `lineKey` internally. Only `CartDrawer` and `CheckoutForm` import `lineKey`.)

- [ ] **Step 4: Type-check.** Run `npx tsc --noEmit` — it will now report errors in `CartDrawer.tsx` and `CheckoutForm.tsx` (they still call `setQty(item.sku, ...)`). Those are fixed in Tasks 4.3 and 5.2.

### Task 4.3: Cart drawer shows size + uses line keys

**Files:** Modify `components/Cart/CartDrawer.tsx`

- [ ] **Step 1: Import `lineKey`** (extend the `@/lib/cart` import):

```ts
import { MAX_QUANTITY, lineKey } from '@/lib/cart';
```

- [ ] **Step 2: Composite React key + size-aware handles.** In the `items.map` block, change the `<li>` key, the two `setQty` calls, the `remove` call, and the spec line:

```tsx
              {items.map((item) => {
                const product = productsBySku.get(item.sku);
                if (!product) return null;
                const thumbUrl = product.productPictures[0]?.url;
                const key = lineKey(item);
                return (
                  <li key={key} className={styles.line}>
```

Spec line (was the hardcoded `OVERSIZE · ОДИН РОЗМІР`):

```tsx
                      <div className={`${styles.lineSpec} mono`}>
                        {item.size ? `РОЗМІР · ${item.size}` : 'ОДИН РОЗМІР'}
                      </div>
```

Decrement / increment / remove handlers:

```tsx
                            setQty(key, item.quantity - 1);
```
```tsx
                            setQty(key, item.quantity + 1);
```
```tsx
                        onClick={() => remove(key)}
```

- [ ] **Step 3: Verify in browser.** Add the **M** and **L** of the sized product → the drawer shows **two** lines, each with its `РОЗМІР · M` / `РОЗМІР · L`, independent steppers, independent remove. The one-size product shows `ОДИН РОЗМІР`.

- [ ] **Step 4: Commit.**
```bash
git add components/Cart/CartProvider.tsx components/Cart/CartDrawer.tsx
git commit -m "feat(size): thread size through cart provider + drawer (storage v2)"
```

---

# Phase 5 — Checkout, payment & seller notification

### Task 5.1: Carry `size` in the checkout contract (TDD)

**Files:** Modify `lib/checkoutSchema.ts`; Tests `lib/__tests__/checkout-schema.test.ts`, `lib/__tests__/validateCheckout.test.ts`

- [ ] **Step 1: Update test fixtures to include `size`.** In `lib/__tests__/checkout-schema.test.ts`, change the `base.items` and the multi-line case, and add a missing-size rejection test:

```ts
  items: [{ sku: 'DROP01-OVERSIZE', size: 'M', quantity: 1 }],
```
```ts
      items: [
        { sku: 'DROP01-OVERSIZE', size: 'M', quantity: 1 },
        { sku: 'DROP01-PRODUCT2', size: '', quantity: 2 },
      ],
```
Add this case inside `describe('checkoutSchema', ...)`:
```ts
  it('rejects a line missing the size key', () => {
    expect(
      checkoutSchema.safeParse({
        ...base,
        items: [{ sku: 'DROP01-OVERSIZE', quantity: 1 }],
      }).success,
    ).toBe(false);
  });

  it('accepts an empty-string size (one-size product)', () => {
    expect(
      checkoutSchema.safeParse({
        ...base,
        items: [{ sku: 'DROP01-OVERSIZE', size: '', quantity: 1 }],
      }).success,
    ).toBe(true);
  });
```
In `lib/__tests__/validateCheckout.test.ts`, update the `valid.items` fixture:
```ts
  items: [{ sku: 'DROP01-OVERSIZE', size: 'M', quantity: 1 }],
```

- [ ] **Step 2: Run; verify the new "rejects a line missing the size key" test FAILS** (schema doesn't require size yet): `npx vitest run lib/__tests__/checkout-schema.test.ts`.

- [ ] **Step 3: Add `size` to `lineItemSchema`** in `lib/checkoutSchema.ts` (empty string allowed = one-size; the key must be present):

```ts
const lineItemSchema = z.object({
  sku: z.string().min(1),
  size: z.string(),
  quantity: z.number().int().min(1, 'Кількість має бути не менше 1'),
});
```

- [ ] **Step 4: Run both test files; verify PASS.** `npx vitest run lib/__tests__/checkout-schema.test.ts lib/__tests__/validateCheckout.test.ts` → green. (`CheckoutLineItem` type, re-exported via `lib/types.ts`, now includes `size`.)

- [ ] **Step 5: Commit.**
```bash
git add lib/checkoutSchema.ts lib/__tests__/checkout-schema.test.ts lib/__tests__/validateCheckout.test.ts
git commit -m "feat(size): size required on checkout line items"
```

### Task 5.2: Send size from the checkout form

**Files:** Modify `components/Checkout/CheckoutForm.tsx`

- [ ] **Step 1: Import `lineKey`** (extend the `@/lib/cart` import):

```ts
import { MAX_QUANTITY, lineKey } from '@/lib/cart';
```

- [ ] **Step 2: Include `size` in the POST payload** (line 54):

```ts
  const items = cart.items.map((i) => ({ sku: i.sku, size: i.size, quantity: i.quantity }));
```

- [ ] **Step 3: Composite key + size-aware steppers + show size** in the `cart.items.map` block. Compute the key, use it for the `<li>` key and both `setQty` calls, and render the size:

```tsx
        {cart.items.map((item) => {
          const product = cart.productsBySku.get(item.sku);
          if (!product) return null;
          const thumbUrl = product.productPictures[0]?.url;
          const key = lineKey(item);
          return (
            <li key={key} className={styles.orderLine}>
```
```tsx
                <div className={`${styles.orderLineSpec} mono`}>
                  {item.size ? `РОЗМІР · ${item.size}` : 'ОДИН РОЗМІР'}
                </div>
```
```tsx
                      cart.setQty(key, item.quantity - 1);
```
```tsx
                      cart.setQty(key, item.quantity + 1);
```

- [ ] **Step 4: Type-check + verify.** `npx tsc --noEmit` → clean (CheckoutForm/CartDrawer no longer pass `item.sku` to `setQty`). In the browser, open checkout with two sizes of one product → two summary lines each showing its size; steppers act independently.

- [ ] **Step 5: Commit.**
```bash
git add components/Checkout/CheckoutForm.tsx
git commit -m "feat(size): checkout summary + payload carry size"
```

### Task 5.3: Embed size in the WayForPay product name

**Files:** Modify `app/api/checkout/route.ts`

- [ ] **Step 1: Add `size` to the server `LineItem`** interface:

```ts
interface LineItem {
  product: Product;
  size: string;
  quantity: number;
}
```

- [ ] **Step 2: Capture `line.size`** when building each line item:

```ts
    lineItems.push({ product, size: line.size, quantity: Math.min(MAX_QUANTITY, line.quantity) });
```

- [ ] **Step 3: Embed the size in `productName`** (the only per-line text WayForPay echoes back to the callback):

```ts
  const productName = lineItems.map((li) =>
    li.size
      ? `Футболка - ${li.product.productName} (Розмір: ${li.size})`
      : `Футболка - ${li.product.productName}`,
  );
```

(`purchaseSignature` signs whatever `productName` strings we build — no signature change. Price is still re-derived from the product by SKU, so size carries no price impact.)

- [ ] **Step 4: Type-check.** `npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit.** `git add app/api/checkout/route.ts && git commit -m "feat(size): embed size in WayForPay product name"`

### Task 5.4: Show real items + sizes in the manager Telegram alert

**Files:** Modify `lib/telegram.ts`, `app/api/wayforpay-callback/route.ts`

- [ ] **Step 1: Model order lines in `OrderMessage` and render them** (`lib/telegram.ts`). Replace the interface + the `Товар` line of `formatOrderMessage`:

```ts
interface OrderLine {
  name: string;
  quantity: number;
}

interface OrderMessage {
  orderReference: string;
  lines: OrderLine[];
  fullName: string;
  phone: string;
  email: string;
  city: string;
  warehouse: string;
  amount: number;
}
```

In `formatOrderMessage`, replace the hardcoded `Товар` line with a rendered list (falls back to a dash if WayForPay sent nothing parseable):

```ts
  const goods =
    o.lines.length > 0
      ? o.lines.map((l) => `• ${l.name} ×${l.quantity}`).join('\n')
      : '—';
  return [
    '🛒 <b>Нове замовлення</b>',
    `<b>№:</b> ${o.orderReference}`,
    `<b>Товар:</b>\n${goods}`,
    `<b>Сума:</b> ${o.amount} ₴`,
    '',
    `<b>Покупець:</b> ${o.fullName}`,
    `<b>Телефон:</b> ${o.phone}`,
    `<b>E-mail:</b> ${o.email}`,
    '',
    `<b>Доставка:</b> ${o.city}, ${o.warehouse}`,
  ].join('\n');
```

(Each `name` already contains `(Розмір: M)` from Task 5.3, so size shows automatically.)

- [ ] **Step 2: Parse the echoed product arrays in the callback** (`app/api/wayforpay-callback/route.ts`). WayForPay returns the signed `productName[]` / `productCount[]` in the callback body. Build `lines` and pass them:

```ts
      const names: string[] = Array.isArray(body.productName)
        ? body.productName
        : body.productName
          ? [body.productName]
          : [];
      const counts: unknown[] = Array.isArray(body.productCount)
        ? body.productCount
        : body.productCount != null
          ? [body.productCount]
          : [];
      const lines = names.map((name: string, i: number) => ({
        name,
        quantity: Number(counts[i] ?? 1),
      }));

      const text = formatOrderMessage({
        orderReference: body.orderReference,
        lines,
        fullName: `${body.clientLastName ?? ''} ${body.clientFirstName ?? ''}`.trim() || '—',
        phone: body.phone ?? body.clientPhone ?? '—',
        email: body.email ?? body.clientEmail ?? '—',
        city: body.deliveryCity ?? '—',
        warehouse: body.deliveryWarehouse ?? '—',
        amount: body.amount,
      });
```

- [ ] **Step 3: Type-check.** `npx tsc --noEmit` → clean.

- [ ] **Step 4: Verify the message shape with a unit test** (the order message is pure logic — add a quick test). Create `lib/__tests__/telegram.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { formatOrderMessage } from '../telegram';

describe('formatOrderMessage', () => {
  it('renders each ordered line with its size-bearing name and quantity', () => {
    const text = formatOrderMessage({
      orderReference: 'DROP01-1',
      lines: [
        { name: 'Футболка - Tee (Розмір: M)', quantity: 2 },
        { name: 'Футболка - Hat', quantity: 1 },
      ],
      fullName: 'Іван Іванов',
      phone: '+380671234567',
      email: 'a@b.com',
      city: 'Львів',
      warehouse: 'Відділення №1',
      amount: 5200,
    });
    expect(text).toContain('• Футболка - Tee (Розмір: M) ×2');
    expect(text).toContain('• Футболка - Hat ×1');
  });

  it('shows a dash when no lines were provided', () => {
    const text = formatOrderMessage({
      orderReference: 'DROP01-2',
      lines: [],
      fullName: '—',
      phone: '—',
      email: '—',
      city: '—',
      warehouse: '—',
      amount: 0,
    });
    expect(text).toContain('<b>Товар:</b>\n—');
  });
});
```
Run: `npx vitest run lib/__tests__/telegram.test.ts` → green.

- [ ] **Step 5: Full regression.** Run the whole suite: `npx vitest run` and `npx tsc --noEmit` → all green.

- [ ] **Step 6: Commit.**
```bash
git add lib/telegram.ts app/api/wayforpay-callback/route.ts lib/__tests__/telegram.test.ts
git commit -m "feat(size): manager Telegram alert shows real items + sizes"
```

---

## Manual end-to-end acceptance (after all phases)

1. Bot: `/edit drop-01-oversize` → Sizes → `S,M,L,XL`; leave `drop-01-product2` one-size. Revalidate the storefront.
2. Storefront: the oversize product shows size pills, buttons disabled until a size is chosen; the one-size product buys directly.
3. Add **M** then **L** of the oversize product → two distinct cart lines with independent quantity/remove.
4. Reload the page → cart persists (new `sasha-cart-v2` key); pre-existing `v1` carts are dropped (expected).
5. Checkout summary lists each line with `РОЗМІР · <size>`; the POST body contains `size` per line.
6. (If WayForPay sandbox keys are configured) complete a test payment → the manager Telegram alert lists each ordered item with its `(Розмір: …)` and quantity.

## Out of scope / follow-ups (noted, not implemented)
- Per-size stock / sold-out (kept product-level by decision).
- `lib/catalog.ts` dead code (unused; remove separately if the team confirms).
- The WayForPay callback delivery fields (`deliveryCity`/`deliveryWarehouse`) are not currently sent by `/api/checkout` — a pre-existing gap, unrelated to size.
