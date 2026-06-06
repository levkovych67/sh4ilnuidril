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

/** HTML-повідомлення для чату менеджерів. */
export function formatOrderMessage(o: OrderMessage): string {
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
}

/** Надсилає повідомлення в чат менеджерів. */
export async function sendToTelegram(botToken: string, chatId: string, text: string): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
  if (!res.ok) throw new Error(`Telegram sendMessage failed: ${res.status}`);
}
