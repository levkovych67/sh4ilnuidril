import { createHmac } from 'crypto';

/** HMAC-MD5 hex — формат підпису WayForPay. */
export function hmacMd5(secret: string, data: string): string {
  return createHmac('md5', secret).update(data, 'utf8').digest('hex');
}

interface PurchaseFields {
  merchantAccount: string;
  merchantDomainName: string;
  orderReference: string;
  orderDate: number;
  amount: number;
  currency: string;
  productName: string[];
  productCount: number[];
  productPrice: number[];
}

/** Підпис форми оплати: поля через ";", масиви товарів розгорнуті. */
export function purchaseSignature(secret: string, f: PurchaseFields): string {
  const parts: (string | number)[] = [
    f.merchantAccount, f.merchantDomainName, f.orderReference, f.orderDate,
    f.amount, f.currency,
    ...f.productName, ...f.productCount, ...f.productPrice,
  ];
  return hmacMd5(secret, parts.join(';'));
}

interface CallbackFields {
  merchantAccount: string;
  orderReference: string;
  amount: number;
  currency: string;
  authCode: string;
  cardPan: string;
  transactionStatus: string;
  reasonCode: number;
}

/** Підпис, яким WayForPay підписує колбек — для перевірки автентичності. */
export function callbackSignature(secret: string, f: CallbackFields): string {
  return hmacMd5(secret, [
    f.merchantAccount, f.orderReference, f.amount, f.currency,
    f.authCode, f.cardPan, f.transactionStatus, f.reasonCode,
  ].join(';'));
}

/** Підпис нашої відповіді на колбек. */
export function responseSignature(secret: string, orderReference: string, status: string, time: number): string {
  return hmacMd5(secret, [orderReference, status, time].join(';'));
}
