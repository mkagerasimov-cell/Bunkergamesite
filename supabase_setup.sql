-- SQL скрипт для настройки таблицы users в Supabase
-- Скопируйте этот код в SQL Editor в Supabase Dashboard

-- Создание таблицы пользователей
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  email TEXT,
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Создание индекса для быстрого поиска по username
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Включение Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Политика: разрешить всем читать пользователей (для публичного API)
CREATE POLICY "Allow public read access" ON users
  FOR SELECT
  USING (true);

-- Политика: разрешить всем создавать пользователей (для регистрации)
CREATE POLICY "Allow public insert" ON users
  FOR INSERT
  WITH CHECK (true);

-- Политика: разрешить всем обновлять пользователей (через service_role key)
-- Service role key обходит RLS, поэтому эта политика не критична
CREATE POLICY "Allow public update" ON users
  FOR UPDATE
  USING (true);

-- Политика: разрешить всем удалять пользователей (через service_role key)
CREATE POLICY "Allow public delete" ON users
  FOR DELETE
  USING (true);

-- Комментарии к таблице
COMMENT ON TABLE users IS 'Таблица пользователей игры Bunker';
COMMENT ON COLUMN users.username IS 'Уникальное имя пользователя';
COMMENT ON COLUMN users.password IS 'Пароль пользователя (хранится в открытом виде, для продакшена лучше использовать хеширование)';
COMMENT ON COLUMN users.email IS 'Email пользователя';
COMMENT ON COLUMN users.is_admin IS 'Флаг администратора';
COMMENT ON COLUMN users.registered_at IS 'Дата регистрации';

