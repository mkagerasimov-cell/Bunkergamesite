# Bunker Tool - Игра "Бункер"

Веб-приложение для игры "Бункер" с генерацией карточек игроков, голосованием и управлением игровым процессом.

## Файлы проекта

- `index.html` - главная страница
- `style.css` - стили
- `script.js` - логика приложения
- `users.json` - база данных пользователей (авторизация)
- `bg.jpg`, `bg2.jpg`, `bgc.jpg` - фоновые изображения

## Деплой на Netlify

1. Зайдите на [netlify.com](https://www.netlify.com)
2. Нажмите "Sign up" (можно через GitHub)
3. После входа нажмите "Add new site" → "Deploy manually"
4. Перетащите всю папку проекта в область деплоя
5. Готово! Сайт будет доступен по адресу `random-name-123.netlify.app`

## Локальный запуск

Просто откройте `index.html` в браузере или используйте локальный сервер:

```bash
# Python
python -m http.server 8000

# Node.js (http-server)
npx http-server
```

Затем откройте http://localhost:8000

