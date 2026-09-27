# Каталог банок энергетиков — передача проекта

Личное веб-приложение: каталог коллекции банок энергетиков с аккаунтами, фото, оценками. Живёт на VPS, код на GitHub.

## Стек и архитектура

- **Backend:** `server.js` — чистый Node.js, **0 npm-зависимостей** (node:http, node:sqlite, node:crypto). Требуется Node ≥ 24 (node:sqlite стабилен). Порт по умолчанию 3000 (`PORT`, `DATA_DIR` — env).
- **Frontend:** `public/` (index.html, styles.css, app.js) — ванильный JS, без сборки. Статику отдаёт тот же server.js.
- **БД:** SQLite `/app/data/catalog.db` (docker volume `./data`). Таблицы: `users`, `sessions`, `cans` (PK `user_id`+`id`, фото — BLOB). При удалении тома данные теряются.
- **Auth:** логин/пароль (scrypt + соль), сессия в HttpOnly-cookie на 30 дней. Регистрация открытая для всех.
- **Seed:** `data.js` читается сервером; новые аккаунты получают эти 10 банок. Правка файла влияет только на будущие аккаунты.
- **API:** `/api/register|login|logout|me|health`, CRUD `/api/cans` (+`/api/cans/:id/rating` PATCH, `DELETE /api/cans/:id`), фото `/api/photos/:id`. JSON, куки-сессии.

## Ресурсы

- **Репозиторий:** https://github.com/qustareunSPm/energy-can-catalog (public, ветка `main`).
- **Локальная копия:** `C:\Users\qusta\Documents\project1`, remote `origin` настроен.
- **Прод:** https://collectionqusta.duckdns.org (DNS → 103.228.168.184).
- **Стиль коммитов:** русский, без префиксов, короткое описание сути.

## Деплой (VPS)

- **VPS:** Ubuntu 26.04, Docker 29.8.1 + compose v5.5.1. SSH-пользователь `qusta` в группе `docker` — для docker-команд sudo не нужен.
- **Каталог приложения на VPS:** `~/collection` (server.js, data.js, Dockerfile, docker-compose.yml, public/). Там compose-файл **только с сервисом `app`** (без caddy), подключён к внешней сети `vaultwarden_default`.
- **Обновление:** залить новые файлы (или git pull, если добавить remote на VPS) → `cd ~/collection && docker compose up -d --build`.
- **Реверс-прокси:** используется **уже существующий Caddy** другого проекта: конфиг `/home/qusta/vaultwarden/Caddyfile`, сайт-блок `collectionqusta.duckdns.org → reverse_proxy collection-app:3000`. После правки конфига: `docker exec caddy caddy reload --config /etc/caddy/Caddyfile`. Сертификаты Let's Encrypt — автоматом.
- **Соседи по VPS:** vaultwarden, password-bot, 3x-ui — не трогать. Порт 3000 наружу не проброшен, только через Caddy.

## Важные ограничения

- `.gitignore` исключает `data/`, `*.db` — БД и секреты в git не попадают; паролей в репо нет.
- GitHub Pages включён, но `index.html` делает редирект на основной домен — Pages хостом не считать.
- В `Dockerfile` база `node:24-alpine`, флаги для sqlite не нужны.
- Статика отдаётся с `Cache-Control: no-cache` — при правках фронтенда жёсткий кэш не должен мешать, но после деплоя просить пользователя Ctrl+F5 не вредно.
- SSH-пароль VPS засвечен в переписке — сменить (`passwd`), в идеале перейти на ключи и отключить парольный вход.
