# PVP Run — Telegram Mini App

## Описание
Игра для бегунов с механикой захвата территории. Бегаешь — захватываешь гексагональные зоны на карте. Другие игроки видят твою территорию и могут перезахватить.

## Стек
- **Frontend:** React + TypeScript + Vite
- **Карта:** MapLibre GL JS (тёмная тема, CARTO basemap)
- **Гексагональная сетка:** H3-js (resolution 10, ~35м)
- **Backend:** Vercel Serverless Functions (api/)
- **БД:** Supabase (PostgreSQL + RLS)
- **Авторизация:** Telegram initData → HMAC валидация → JWT
- **GPS трекинг:** Двойной канал — браузерный GPS + Telegram Live Location через бота
- **Бот:** @RunPVP_bot (webhook на /api/bot)
- **Деплой:** Vercel (auto-deploy с GitHub)

## Структура проекта
```
api/                  — Vercel serverless functions
  auth.ts             — Telegram initData валидация + JWT
  bot.ts              — Webhook бота (GPS, команды, уведомления)
  active-run.ts       — Управление активными забегами (start/stop/get)
  track-point.ts      — Приём GPS точек от браузера
  runs.ts             — История забегов (save/fetch)
  zones.ts            — Захваченные зоны (get all / batch capture)
  leaderboard.ts      — Лидерборд игроков
  player-info.ts      — Информация об игроке
  players.ts          — Активные бегуны на карте
src/
  components/
    Map.tsx            — Карта с гексами, треком, маркерами игроков
    RunPanel.tsx       — Панель забега (start/stop, stats, live indicator)
    Profile.tsx        — Профиль с историей забегов
    Leaderboard.tsx    — Лидерборд
    PlayerPopup.tsx    — (deprecated) Попап игрока
  hooks/
    useLocation.ts     — GPS трекинг через navigator.geolocation
    useRun.ts          — Логика забега (start/stop/track, серверная синхронизация)
    useTelegram.ts     — Инициализация Telegram SDK
  contexts/
    AuthContext.tsx     — Авторизация через Telegram
  lib/
    hexGrid.ts         — H3 утилиты (видимые гексы, трек→гексы, полигон→гексы)
    supabase.ts        — Supabase клиент
    auth.ts            — Вызов /api/auth
    runs.ts            — Вызов /api/runs
    zones.ts           — Вызов /api/zones
  types/
    location.ts, auth.ts, run.ts, zone.ts
```

## Таблицы Supabase
- **users** — id, telegram_id, first_name, username, color, total_distance_m, total_runs, total_territories
- **zones** — h3_index (PK), owner_id, owner_color, captured_at
- **runs** — id, user_id, started_at, finished_at, distance_m, duration_s, avg_speed_kmh, track (JSONB), territory (JSONB)
- **active_runs** — id, user_id (UNIQUE), started_at
- **track_points** — id, run_id, user_id, latitude, longitude, timestamp

## Ключевые решения
- initData парсится вручную (не URLSearchParams) — избегаем + → space баг
- Bot token: всегда .trim() — избегаем \n от echo в env
- H3 polygonToCells: без флага true (используем [lat,lng] формат)
- Два канала GPS: браузер (высокая частота) + бот Live Location (фоновый)
- Захват территории в реальном времени при каждой GPS точке
- Забег восстанавливается при перезагрузке Mini App

## Команды
```bash
npm run dev          # Локальная разработка
npm run build        # Сборка
vercel --prod        # Деплой
```

## Env переменные (Vercel)
- TELEGRAM_BOT_TOKEN
- RunPVP_SUPABASE_URL
- RunPVP_SUPABASE_SERVICE_ROLE_KEY
- RunPVP_SUPABASE_JWT_SECRET
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
