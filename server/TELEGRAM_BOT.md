# EDUMAP Telegram Bot (MVP)

## Что умеет
- Пошаговый поиск школ по фильтрам:
  - город
  - район
  - тип школы
  - диапазон цены
- Показывает результаты карточками и кнопку `Показать еще`.

## Что нужно
- `TELEGRAM_BOT_TOKEN` от `@BotFather`.

## Запуск локально
```bash
cd server
TELEGRAM_BOT_TOKEN=123456:ABC npm run telegram
```

## Запуск на Render/другом хостинге
- Создай отдельный worker service.
- Команда запуска:
```bash
npm run telegram
```
- Env:
```bash
TELEGRAM_BOT_TOKEN=...
```

## Как пользоваться
- Открой бота в Telegram.
- Отправь `/start`.
- Выбери фильтры через inline-кнопки.

