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

-- Удаляем старые политики, если они есть
DROP POLICY IF EXISTS "Allow public read access" ON users;
DROP POLICY IF EXISTS "Allow public insert" ON users;
DROP POLICY IF EXISTS "Allow public update" ON users;
DROP POLICY IF EXISTS "Allow public delete" ON users;

-- Политика: разрешить всем читать пользователей (для публичного API через anon key)
CREATE POLICY "Allow public read access" ON users
  FOR SELECT
  USING (true);

-- Политика: разрешить всем создавать пользователей (для регистрации через anon key)
CREATE POLICY "Allow public insert" ON users
  FOR INSERT
  WITH CHECK (true);

-- Политика: разрешить всем обновлять пользователей
-- Service role key обходит RLS автоматически, но политика нужна для anon key
CREATE POLICY "Allow public update" ON users
  FOR UPDATE
  USING (true);

-- Политика: разрешить всем удалять пользователей
-- Service role key обходит RLS автоматически, но политика нужна для anon key
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

-- Создание таблицы готовых игроков
CREATE TABLE IF NOT EXISTS ready_players (
  id BIGSERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  role_mode TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Создание индекса для быстрого поиска по username
CREATE INDEX IF NOT EXISTS idx_ready_players_username ON ready_players(username);

-- Включение Row Level Security (RLS)
ALTER TABLE ready_players ENABLE ROW LEVEL SECURITY;

-- Удаляем старые политики, если они есть
DROP POLICY IF EXISTS "Allow public read access" ON ready_players;
DROP POLICY IF EXISTS "Allow public insert" ON ready_players;
DROP POLICY IF EXISTS "Allow public update" ON ready_players;
DROP POLICY IF EXISTS "Allow public delete" ON ready_players;

-- Политика: разрешить всем читать готовых игроков
CREATE POLICY "Allow public read access" ON ready_players
  FOR SELECT
  USING (true);

-- Политика: разрешить всем добавлять готовых игроков
CREATE POLICY "Allow public insert" ON ready_players
  FOR INSERT
  WITH CHECK (true);

-- Политика: разрешить всем обновлять готовых игроков
CREATE POLICY "Allow public update" ON ready_players
  FOR UPDATE
  USING (true);

-- Политика: разрешить всем удалять готовых игроков
CREATE POLICY "Allow public delete" ON ready_players
  FOR DELETE
  USING (true);

-- Комментарии к таблице
COMMENT ON TABLE ready_players IS 'Таблица готовых игроков для игры Bunker';
COMMENT ON COLUMN ready_players.username IS 'Имя пользователя';
COMMENT ON COLUMN ready_players.timestamp IS 'Время регистрации готовности';
COMMENT ON COLUMN ready_players.role_mode IS 'Режим ролей (для админа)';
COMMENT ON COLUMN ready_players.is_admin IS 'Флаг администратора';

