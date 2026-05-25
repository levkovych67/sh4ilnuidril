import { NextRequest, NextResponse } from 'next/server';
import { purchaseSignature } from '@/lib/wayforpay';
import { checkoutSchema } from '@/lib/checkoutSchema';
import { SITE_URL, requireEnv } from '@/lib/config';
import {
  getProduct,
  ProductNotFoundError,
  ProductsApiError,
  type Product,
} from '@/lib/products';
import { MAX_QUANTITY } from '@/lib/cart';

interface LineItem {
  product: Product;
  quantity: number;
}

export async function POST(req: NextRequest) {
  const parsed = checkoutSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const lineItems: LineItem[] = [];
  for (const line of input.items) {
    let product: Product;
    try {
      product = await getProduct(line.sku);
    } catch (err) {
      if (err instanceof ProductNotFoundError) {
        return NextResponse.json(
          { error: 'unknown_sku', sku: line.sku },
          { status: 400 },
        );
      }
      if (err instanceof ProductsApiError) {
        return NextResponse.json(
          { error: 'products_api_unavailable' },
          { status: 500 },
        );
      }
      throw err;
    }
    lineItems.push({ product, quantity: Math.min(MAX_QUANTITY, line.quantity) });
  }

  const merchantAccount = requireEnv('WAYFORPAY_MERCHANT_ACCOUNT');
  const merchantDomainName = requireEnv('WAYFORPAY_MERCHANT_DOMAIN');
  const secret = requireEnv('WAYFORPAY_SECRET_KEY');

  const orderReference = `DROP01-${Date.now()}`;
  const orderDate = Math.floor(Date.now() / 1000);
  const [lastName, ...firstParts] = input.fullName.trim().split(/\s+/);

  const productName = lineItems.map((li) => `Футболка - ${li.product.productName}`);
  const productCount = lineItems.map((li) => li.quantity);
  const productPrice = lineItems.map((li) => li.product.productPrice);
  const amount = lineItems.reduce((s, li) => s + li.product.productPrice * li.quantity, 0);
  // All catalog products today are UAH. Mixed-currency support is future work.
  const currency = 'UAH';

  const base = {
    merchantAccount,
    merchantDomainName,
    orderReference,
    orderDate,
    amount,
    currency,
    productName,
    productCount,
    productPrice,
  };

  const params = {
    ...base,
    merchantSignature: purchaseSignature(secret, base),
    clientFirstName: firstParts.join(' ') || '-',
    clientLastName: lastName,
    clientEmail: input.email,
    clientPhone: input.phone.replace(/\s/g, ''),
    language: 'UA',
    serviceUrl: `${SITE_URL}/api/wayforpay-callback`,
    returnUrl: SITE_URL,
    merchantTransactionSecureType: 'AUTO',
  };

  return NextResponse.json(params);
}
