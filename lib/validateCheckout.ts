import { checkoutSchema, type CheckoutInput } from './checkoutSchema';

export type FieldErrors = Partial<Record<keyof CheckoutInput, string>>;

export function validateCheckout(data: CheckoutInput): FieldErrors {
  const result = checkoutSchema.safeParse(data);
  if (result.success) return {};
  const flat = result.error.flatten().fieldErrors;
  const out: FieldErrors = {};
  for (const k of Object.keys(flat) as (keyof CheckoutInput)[]) {
    const msg = flat[k]?.[0];
    if (msg) out[k] = msg;
  }
  return out;
}
