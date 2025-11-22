# Отладка проблемы с сохранением в Supabase

## Проблема: Данные не сохраняются в Supabase

Если регистрация работает, но в таблице Supabase пусто, проверьте следующее:

## Шаг 1: Проверьте логи Netlify Functions

1. **Откройте Netlify Dashboard**
2. Ваш сайт → **Functions** → **saveUser**
3. Нажмите **"View logs"**
4. Попробуйте зарегистрировать пользователя
5. Смотрите логи в реальном времени

### Что искать в логах:

**Если видите:**
- `Supabase credentials not configured` → переменные окружения не установлены
- `Supabase error: 401` → неправильный ключ
- `Supabase error: 404` → таблица не найдена
- `Supabase error: 409` → пользователь уже существует
- `Supabase error: 500` → ошибка на стороне Supabase

## Шаг 2: Проверьте переменные окружения

1. Netlify → Site settings → Environment variables
2. Должны быть:
   - `SUPABASE_URL` = `https://xxxxx.supabase.co`
   - `SUPABASE_ANON_KEY` = `eyJhbGc...`
   - `SUPABASE_SERVICE_KEY` = `eyJhbGc...`
3. **Важно**: После добавления переменных нужно передеплоить!

## Шаг 3: Проверьте таблицу в Supabase

1. **Откройте Supabase Dashboard**
2. Table Editor → users
3. Убедитесь, что таблица существует
4. Проверьте структуру таблицы:
   - `id` (BIGSERIAL)
   - `username` (TEXT)
   - `password` (TEXT)
   - `email` (TEXT)
   - `registered_at` (TIMESTAMPTZ)
   - `is_admin` (BOOLEAN)

## Шаг 4: Проверьте RLS политики

1. Supabase → Authentication → Policies
2. Или SQL Editor → выполните:

```sql
-- Проверка политик
SELECT * FROM pg_policies WHERE tablename = 'users';
```

3. Должны быть политики:
   - `Allow public read access` (SELECT)
   - `Allow public insert` (INSERT)

## Шаг 5: Проверьте в консоли браузера

1. Откройте консоль (F12)
2. Попробуйте зарегистрироваться
3. Смотрите сообщения:
   - `Отправка запроса на: /.netlify/functions/saveUser`
   - `Статус ответа: 200 OK`
   - `Ответ от сервера: {success: true, ...}`

## Шаг 6: Тест напрямую через Supabase

Попробуйте создать пользователя напрямую через Supabase:

1. Supabase → Table Editor → users
2. Нажмите "Insert row"
3. Заполните:
   - `username`: test
   - `password`: test123
   - `email`: test@test.com
4. Сохраните

Если это работает, значит проблема в Netlify Functions или в запросе.

## Частые проблемы и решения:

### Проблема 1: "Supabase credentials not configured"
**Решение**: 
- Проверьте переменные окружения в Netlify
- Передеплойте сайт после добавления переменных

### Проблема 2: "Supabase error: 401 Unauthorized"
**Решение**:
- Проверьте, что `SUPABASE_SERVICE_KEY` правильный
- Убедитесь, что это именно service_role key, а не anon key

### Проблема 3: "Supabase error: 404 Not Found"
**Решение**:
- Проверьте, что таблица `users` создана
- Проверьте, что URL правильный (должен быть `/rest/v1/users`)

### Проблема 4: "Supabase error: 409 Conflict"
**Решение**:
- Пользователь уже существует
- Попробуйте другое имя пользователя

### Проблема 5: RLS блокирует запись
**Решение**:
- Service role key должен обходить RLS
- Проверьте, что используете именно service_role key, а не anon key

## Проверка через SQL в Supabase:

Выполните в SQL Editor:

```sql
-- Проверка данных
SELECT * FROM users;

-- Проверка структуры таблицы
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users';

-- Проверка политик RLS
SELECT * FROM pg_policies WHERE tablename = 'users';
```

## Если ничего не помогает:

1. Скопируйте логи из Netlify Functions
2. Скопируйте сообщения из консоли браузера
3. Проверьте, что все переменные окружения установлены
4. Убедитесь, что сайт передеплоен после добавления переменных

