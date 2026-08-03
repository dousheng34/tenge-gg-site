# tenge-gg-site
Первый игровой маркетплейс Казахстана — донат, аккаунты и валюта через Kaspi QR

## Стек

Next.js 15 (App Router, RSC + Server Actions) · Supabase (Postgres, Auth, Realtime, Storage) ·
Tailwind CSS · Kaspi QR · Telegram-уведомления

## Быстрый старт

```bash
cp .env.example .env.local   # заполнить ключи Supabase
npm install                  # нужен Node 22+
npm run dev                  # http://localhost:3000
```

Проверки перед PR: `npm run typecheck` и `npm run build`.

## Документация

- `docs/WEB-APP.md` — маршруты Next.js-приложения, слои данных, статус миграции
- `docs/ESCROW.md` — стейт-машина escrow, SLA-таймеры, вебхук Kaspi
- `docs/UI-KIT.md` — UI-кит: скелетоны, тосты, модалки, валидация форм
- `docs/ci.workflow.example.yml` — шаблон CI (копируется в `.github/workflows/ci.yml` вручную)

Статические HTML-страницы в корне (`index.html`, `catalog.html`, `profile.html`, `admin.html` …) —
legacy-версия сайта, она постепенно заменяется маршрутами в `src/app/`.
