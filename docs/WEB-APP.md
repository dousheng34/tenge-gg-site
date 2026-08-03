# Next.js-приложение tenge.gg

Ветка `feat/web-app` переносит маркетплейс со статических HTML-страниц на Next.js 15 (App Router,
RSC + Server Actions) поверх той же базы Supabase и escrow-стейт-машины из `docs/ESCROW.md`.

## Локальный запуск

```bash
cp .env.example .env.local   # заполнить ключи Supabase
npm install
npm run dev                  # http://localhost:3000
npm run typecheck            # tsc --noEmit
npm run build                # прод-сборка
```

Требуется **Node 22+** (`@supabase/supabase-js` >= 2.110 не поддерживает Node 20).

## Маршруты

| Маршрут | Что делает | Доступ |
|---|---|---|
| `/` | лендинг: витрина лотов, доверие, FAQ | публичный |
| `/catalog` | каталог с фильтрами в URL, скелетоны | публичный |
| `/lot/[id]` | карточка лота + `BuyPanel` (создание сделки) | публичный, покупка — по сессии |
| `/auth` | вход/регистрация Supabase Auth | публичный |
| `/orders` | «мои сделки» (покупки и продажи) | по сессии |
| `/orders/[id]` | комната сделки: escrow-таймлайн с countdown, действия, realtime-чат | участники сделки |
| `/sell` | публикация лота (Server Action + zod) | по сессии |
| `/arbitration` | очередь споров | роль `arbiter` |
| `/ui-kit` | playground UI-кита | dev |
| `/api/webhooks/kaspi` | вебхук оплаты Kaspi QR (HMAC-подпись) | service-role |
| `/api/cron/escrow-sla` | прогон SLA-таймеров escrow | по `ESCROW_CRON_SECRET` |

Приватные разделы закрыты в `middleware.ts`: без сессии — редирект на `/auth?next=...`.
Там же обновляется JWT, иначе RLS начинает молча отдавать пустые списки.

## Слои

- `src/lib/queries.ts` — чтение данных для RSC (лоты, сделки, сообщения).
- `src/app/actions/*` — мутации через Server Actions (`listings`, `orders`).
- `src/services/escrow.service.ts` + `src/lib/escrow/state-machine.ts` — переходы escrow,
  включая нормализацию legacy-статусов из старого HTML-фронта.
- `src/lib/supabase/{browser,server,admin}.ts` — клиенты: браузерный синглтон, серверный под RLS,
  service-role только для вебхуков и cron.
- `src/components/ui/*` — UI-кит (см. `docs/UI-KIT.md`).

## Безопасность

CSP и security-заголовки задаются в `next.config.ts` (для статики на GH Pages это было невозможно).
`SUPABASE_SERVICE_ROLE_KEY` используется только в серверных обработчиках и никогда не импортируется
в клиентские компоненты (`import 'server-only'`).

## Статус

- [x] каркас, лендинг, каталог, карточка лота, вход
- [x] сделки, комната сделки, escrow-таймлайн, чат, арбитраж, продажа лота
- [x] typecheck и `next build` проходят (зафиксировано в этой ветке)
- [ ] `.github/workflows/ci.yml` — скопировать из `docs/ci.workflow.example.yml` вручную
      (токен интеграции не имеет scope `workflow`)
- [ ] закоммитить `package-lock.json` и вернуть в CI `npm ci`
- [ ] удалить legacy HTML-страницы после переноса профиля и админки
