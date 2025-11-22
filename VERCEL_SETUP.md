# Настройка проекта на Vercel

## Шаги для деплоя на Vercel

### 1. Подготовка проекта

Проект уже настроен для Vercel:
- ✅ Создана папка `api/` с serverless functions
- ✅ Создан файл `vercel.json` с конфигурацией
- ✅ Обновлены пути API в `script.js`

### 2. Установка Vercel CLI (опционально)

```bash
npm i -g vercel
```

### 3. Деплой через веб-интерфейс

1. Перейдите на [vercel.com](https://vercel.com)
2. Войдите через GitHub/GitLab/Bitbucket
3. Нажмите "Add New Project"
4. Импортируйте ваш репозиторий
5. Настройки проекта:
   - **Framework Preset**: Other
   - **Root Directory**: ./
   - **Build Command**: (оставьте пустым)
   - **Output Directory**: ./
6. Нажмите "Deploy"

### 4. Настройка переменных окружения

После деплоя перейдите в настройки проекта → Environment Variables и добавьте:

```
SUPABASE_URL=ваш_supabase_url
SUPABASE_ANON_KEY=ваш_anon_key
SUPABASE_SERVICE_KEY=ваш_service_key
```

**Важно:** 
- Переменные должны быть названы ЗАГЛАВНЫМИ БУКВАМИ
- После добавления переменных нужно передеплоить проект

### 5. Настройка Supabase

Убедитесь, что в Supabase созданы таблицы:
- `users` (уже должна быть)
- `ready_players` (нужно создать)

Выполните SQL скрипт из файла `supabase_setup.sql` в Supabase Dashboard → SQL Editor.

### 6. Структура проекта

```
/
├── api/                    # Vercel Serverless Functions
│   ├── getUsers.js
│   ├── saveUser.js
│   ├── getReadyPlayers.js
│   └── saveReadyPlayer.js
├── index.html
├── script.js
├── style.css
├── vercel.json            # Конфигурация Vercel
└── supabase_setup.sql     # SQL для создания таблиц
```

### 7. Локальная разработка

Для локальной разработки с Vercel:

```bash
# Установите Vercel CLI
npm i -g vercel

# Запустите локальный сервер
vercel dev
```

Это запустит сервер на `http://localhost:3000` с поддержкой serverless functions.

### 8. Проверка работы

После деплоя проверьте:
1. Главная страница открывается
2. API функции работают (проверьте в Network tab браузера)
3. Авторизация работает
4. Готовность игроков синхронизируется

### 9. Отличия от Netlify

- **Пути API**: `/api/functionName` вместо `/.netlify/functions/functionName`
- **Формат функций**: `export default async function handler(req, res)` вместо `exports.handler = async (event, context) => {}`
- **Конфигурация**: `vercel.json` вместо `netlify.toml`

### 10. Troubleshooting

**Проблема: API функции не работают**
- Проверьте, что функции находятся в папке `api/`
- Проверьте формат функций (должен быть `export default`)
- Проверьте переменные окружения в Vercel Dashboard

**Проблема: CORS ошибки**
- Проверьте заголовки в `vercel.json`
- Убедитесь, что функции устанавливают CORS заголовки

**Проблема: Переменные окружения не работают**
- Убедитесь, что названия переменных ЗАГЛАВНЫМИ БУКВАМИ
- Передеплойте проект после добавления переменных

