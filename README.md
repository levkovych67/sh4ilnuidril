# Sasha Chemerov Merch v3.2

Односторінковий лендинг продажу футболки Sasha Chemerov. Стек: Next.js + Vercel.

## Встановлення

```bash
npm install
```

## Змінні оточення

Скопіювати `.env.local.example` у `.env.local` і заповнити значення:

```bash
cp .env.local.example .env.local
```

| Змінна | Де взяти |
|--------|----------|
| `WAYFORPAY_MERCHANT_ACCOUNT` | Кабінет WayForPay — розділ "Мерчанти" |
| `WAYFORPAY_SECRET_KEY` | Кабінет WayForPay — секретний ключ мерчанта |
| `WAYFORPAY_MERCHANT_DOMAIN` | Домен сайту (за замовчуванням `isusneisus.com`) |
| `NOVAPOSHTA_API_KEY` | Кабінет Нової Пошти → Налаштування / Безпека / API |
| `TELEGRAM_BOT_TOKEN` | Створити бота через [@BotFather](https://t.me/BotFather) |
| `TELEGRAM_CHAT_ID` | Додати бота в чат менеджерів, відкрити `https://api.telegram.org/bot<TOKEN>/getUpdates`, узяти `chat.id` |
| `NEXT_PUBLIC_SITE_URL` | Публічний URL сайту (`https://isusneisus.com`) |

## Команди

```bash
npm run dev    # локальна розробка
npm test       # запуск тестів
npm run build  # продакшн-збірка
```

## Деплой

Проєкт деплоїться на Vercel. Усі змінні з `.env.local.example` треба додати в налаштуваннях проєкту Vercel (Settings → Environment Variables).

У кабінеті WayForPay вказати:
- `serviceUrl = https://isusneisus.com/api/wayforpay-callback`
- Увімкнути фіскалізацію (пРРО)
# sh4ilnuidril
