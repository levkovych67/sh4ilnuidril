import { NextRequest, NextResponse } from 'next/server';
import { callbackSignature, responseSignature } from '@/lib/wayforpay';
import { formatOrderMessage, sendToTelegram } from '@/lib/telegram';
import { requireEnv } from '@/lib/config';

export async function POST(req: NextRequest) {
  const secret = requireEnv('WAYFORPAY_SECRET_KEY');
  const body = await req.json();

  // Перевірка автентичності колбеку
  const expected = callbackSignature(secret, {
    merchantAccount: body.merchantAccount,
    orderReference: body.orderReference,
    amount: body.amount,
    currency: body.currency,
    authCode: body.authCode,
    cardPan: body.cardPan,
    transactionStatus: body.transactionStatus,
    reasonCode: body.reasonCode,
  });

  if (expected === body.merchantSignature && body.transactionStatus === 'Approved') {
    try {
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
      await sendToTelegram(requireEnv('TELEGRAM_BOT_TOKEN'), requireEnv('TELEGRAM_CHAT_ID'), text);
    } catch (err) {
      console.error('Telegram notify failed', err);
    }
  }

  // Обовʼязкова підписана відповідь WayForPay
  const time = Math.floor(Date.now() / 1000);
  return NextResponse.json({
    orderReference: body.orderReference,
    status: 'accept',
    time,
    signature: responseSignature(secret, body.orderReference, 'accept', time),
  });
}
