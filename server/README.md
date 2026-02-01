# Edumap backend

Небольшой Express‑сервер, который хранит заявки на консультацию и, при наличии
токена, шлёт уведомления в WhatsApp Business Cloud API.

## Локальный запуск

```bash
cd server
cp .env.example .env   # заполните при необходимости
npm install
npm run dev
```

По умолчанию сервер слушает `http://localhost:4000` и отдаёт эндпоинты:

- `GET /api/health` — проверка статуса
- `GET /api/consultations` — список заявок
- `POST /api/consultations` — создать новую заявку (обязательные поля см. `routes/consultations.js`)
- `POST /api/ai/school-query` — разобрать запрос на подбор школ через LLM
- `POST /api/ai/school-chat` — чат-ответ на основе списка школ (до 30 объектов)

## LLM

Для LLM‑подбора задайте `LLM_API_KEY` или `OPENAI_API_KEY`. По умолчанию
используется `https://api.openai.com/v1` и модель `gpt-4o-mini`. Для
OpenAI‑совместимых прокси укажите `LLM_BASE_URL` и `LLM_PROVIDER=compat`.

## Деплой на Render/Railway

1. Запушьте содержимое папки `server` в репозиторий.
2. В панели Render/Railway создайте новый **Web Service** и выберите этот репо.
3. Укажите build/start команду `npm install && npm start`.
4. В переменных окружения задайте `PORT`, `WHATSAPP_API_URL`, `WHATSAPP_ACCESS_TOKEN`, `LLM_API_KEY` или `OPENAI_API_KEY` (и при необходимости `LLM_BASE_URL`, `LLM_MODEL`).
5. После деплоя используйте выданный публичный URL (например, `https://your-app.onrender.com/api`).

## WhatsApp

Сервер отправляет текстовое сообщение на номер, который приходит из мобильного
приложения (поле `whatsappPhone`). Если переменные `WHATSAPP_API_URL` и
`WHATSAPP_ACCESS_TOKEN` не заданы, уведомление просто пропускается.
