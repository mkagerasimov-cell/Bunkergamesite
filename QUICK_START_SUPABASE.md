# Быстрый старт: Настройка Supabase за 5 минут

## Шаг 1: Создайте проект в Supabase (2 минуты)

1. Откройте https://supabase.com
2. Войдите/зарегистрируйтесь
3. Нажмите "New Project"
4. Заполните:
   - Name: `bunker-game`
   - Database Password: **сохраните пароль!**
   - Region: выберите ближайший
5. Нажмите "Create new project"
6. Подождите 2-3 минуты

## Шаг 2: Получите ключи (1 минута)

1. В проекте: Settings → API
2. Скопируйте:
   - **Project URL** (например: `https://xxxxx.supabase.co`)
   - **anon public key** (длинный ключ)
   - **service_role key** (секретный ключ)

## Шаг 3: Создайте таблицу (1 минута)

1. В проекте: SQL Editor → New query
2. Откройте файл `supabase_setup.sql` из проекта
3. Скопируйте весь SQL код
4. Вставьте в SQL Editor
5. Нажмите "Run" (Ctrl+Enter)
6. Должно появиться "Success"

## Шаг 4: Настройте Netlify (1 минута)

1. В Netlify: Site settings → Environment variables
2. Добавьте 3 переменные:

```
SUPABASE_URL = https://xxxxx.supabase.co
SUPABASE_ANON_KEY = eyJhbGc... (anon key)
SUPABASE_SERVICE_KEY = eyJhbGc... (service_role key)
```

3. Нажмите "Save"
4. **Важно**: Передеплойте сайт! (Deploys → Trigger deploy)

## Готово! ✅

Теперь:
- Зарегистрируйте пользователя на сайте
- Проверьте в Supabase: Table Editor → users
- Откройте админку - пользователь должен быть виден

---

## Проверка работы:

1. **Зарегистрируйте пользователя** на сайте
2. **В Supabase**: Table Editor → users → должен появиться новый пользователь
3. **В админке**: должен отображаться новый пользователь
4. **На другом устройстве**: откройте сайт → пользователи должны синхронизироваться

## Если что-то не работает:

1. Проверьте переменные окружения в Netlify
2. Убедитесь, что передеплоили сайт после добавления переменных
3. Проверьте консоль браузера (F12) на ошибки
4. Проверьте логи Netlify Functions: Netlify → Functions → View logs

## Полезные ссылки:

- Supabase Dashboard: https://app.supabase.com
- Netlify Dashboard: https://app.netlify.com

