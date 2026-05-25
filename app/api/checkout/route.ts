import { NextRequest, NextResponse } from 'next/server';
import { purchaseSignature } from '@/lib/wayforpay';
import { checkoutSchema } from '@/lib/checkoutSchema';
import { SITE_URL, requireEnv } from '@/lib/config';
import { findProduct, type Product } from '@/lib/catalog';
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

  // Per-line catalog lookup — the server is the authority on price.
  const lineItems: LineItem[] = [];
  for (const line of input.items) {
    const product = findProduct(line.sku);
    if (!product) {
      return NextResponse.json({ error: 'unknown_sku', sku: line.sku }, { status: 400 });
    }
    lineItems.push({ product, quantity: Math.min(MAX_QUANTITY, line.quantity) });
  }

  const merchantAccount = requireEnv('WAYFORPAY_MERCHANT_ACCOUNT');
  const merchantDomainName = requireEnv('WAYFORPAY_MERCHANT_DOMAIN');
  const secret = requireEnv('WAYFORPAY_SECRET_KEY');

  const orderReference = `DROP01-${Date.now()}`;
  const orderDate = Math.floor(Date.now() / 1000);
  const [lastName, ...firstParts] = input.fullName.trim().split(/\s+/);

  const productName = lineItems.map((li) => `Футболка - ${li.product.name}`);
  const productCount = lineItems.map((li) => li.quantity);
  const productPrice = lineItems.map((li) => li.product.price);
  const amount = lineItems.reduce((s, li) => s + li.product.price * li.quantity, 0);
  // All catalog products today are UAH; if mixed currencies become a thing,
  // this needs explicit per-line handling. See spec §9.
  const currency = lineItems[0].product.currency;

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
