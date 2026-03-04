-- Migration: Reset schema with new data structure and 4 tiers
-- Adds coolness and weared fields, includes new "DUBAI_SYNAGOGUE" tier

-- Drop existing data and constraints
DROP POLICY IF EXISTS "Users can view own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Users can insert own data" ON users;
DROP POLICY IF EXISTS "Anyone can view items" ON items;
DROP POLICY IF EXISTS "Users can view own items" ON user_items;
DROP POLICY IF EXISTS "Users can manage own items" ON user_items;
DROP POLICY IF EXISTS "Users can view own payments" ON payments;
DROP POLICY IF EXISTS "Users can create own payments" ON payments;

-- Drop existing tables
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS user_items CASCADE;
DROP TABLE IF EXISTS items CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop existing types
DROP TYPE IF EXISTS item_type CASCADE;
DROP TYPE IF EXISTS item_tier CASCADE;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types with new tier
CREATE TYPE item_type AS ENUM (
  'UNDERWEAR',   -- трусы
  'SOCKS',       -- носки  
  'SHOES',       -- обувь
  'PANTS',       -- штаны
  'RING',        -- перстень
  'SHIRT',       -- футболка
  'NECKLACE',    -- ожерелье
  'GLASSES',     -- очки
  'CAP'          -- кепка
);

CREATE TYPE item_tier AS ENUM (
  'POOR',           -- нищук
  'WORKER',         -- работяга
  'RICH',           -- мажор
  'DUBAI_SYNAGOGUE' -- дубайский синагог
);

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  telegram_id TEXT UNIQUE NOT NULL,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  stars INTEGER DEFAULT 0,
  referral_code TEXT UNIQUE DEFAULT uuid_generate_v4()::text,
  referred_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Items table with new fields
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type item_type NOT NULL,
  tier item_tier NOT NULL,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  weared INTEGER DEFAULT 0,  -- новое поле
  coolness INTEGER DEFAULT 0, -- новое поле
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(type, tier)
);

-- User items junction table
CREATE TABLE user_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id),
  equipped BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, item_id)
);

-- Payments table
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  telegram_payment_charge_id TEXT UNIQUE NOT NULL,
  provider_payment_charge_id TEXT,
  total_amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'XTR',
  item_id UUID REFERENCES items(id),
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX idx_users_telegram_id ON users(telegram_id);
CREATE INDEX idx_users_referral_code ON users(referral_code);
CREATE INDEX idx_users_referred_by ON users(referred_by);
CREATE INDEX idx_user_items_user_id ON user_items(user_id);
CREATE INDEX idx_user_items_item_id ON user_items(item_id);
CREATE INDEX idx_items_type ON items(type);
CREATE INDEX idx_items_tier ON items(tier);
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_telegram_charge_id ON payments(telegram_payment_charge_id);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users: Users can only see and modify their own data
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (telegram_id = current_setting('app.telegram_id', true));

CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (telegram_id = current_setting('app.telegram_id', true));

CREATE POLICY "Users can insert own data" ON users
  FOR INSERT WITH CHECK (telegram_id = current_setting('app.telegram_id', true));

-- Items: Anyone can view items (they're public)
CREATE POLICY "Anyone can view items" ON items
  FOR SELECT USING (true);

-- User items: Users can only see and modify their own items
CREATE POLICY "Users can view own items" ON user_items
  FOR SELECT USING (
    user_id IN (
      SELECT id FROM users WHERE telegram_id = current_setting('app.telegram_id', true)
    )
  );

CREATE POLICY "Users can manage own items" ON user_items
  FOR ALL USING (
    user_id IN (
      SELECT id FROM users WHERE telegram_id = current_setting('app.telegram_id', true)
    )
  );

-- Payments: Users can only see their own payments
CREATE POLICY "Users can view own payments" ON payments
  FOR SELECT USING (
    user_id IN (
      SELECT id FROM users WHERE telegram_id = current_setting('app.telegram_id', true)
    )
  );

CREATE POLICY "Users can create own payments" ON payments
  FOR INSERT WITH CHECK (
    user_id IN (
      SELECT id FROM users WHERE telegram_id = current_setting('app.telegram_id', true)
    )
  );

-- Function to update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to automatically update updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert items data according to the provided table
INSERT INTO items (type, tier, name, weared, coolness, price, image_url) VALUES
  -- Нищук tier
  ('UNDERWEAR', 'POOR', 'Часы с рынка', 1, 0, 1, '/images/underwear_poor.png'),
  ('SOCKS', 'POOR', 'Носки с рынка', 5, 1, 50, '/images/socks_poor.png'),
  ('SHOES', 'POOR', 'Стоптанные кроссовки', 12, 2, 120, '/images/shoes_poor.png'),
  ('PANTS', 'POOR', 'Потертые джинсы', 13, 5, 130, '/images/pants_poor.png'),
  ('RING', 'POOR', 'Колечко от Пепси', 4, 3, 40, '/images/ring_poor.png'),
  ('SHIRT', 'POOR', 'Застиранная футболка', 14, 4, 150, '/images/shirt_poor.png'),
  ('NECKLACE', 'POOR', 'Цепочка из проволоки', 16, 6, 160, '/images/necklace_poor.png'),
  ('GLASSES', 'POOR', 'Разбитые очки', 17, 8, 170, '/images/glasses_poor.png'),
  ('CAP', 'POOR', 'Шапка бомжа', 18, 10, 180, '/images/cap_poor.png'),

  -- Работяга tier
  ('UNDERWEAR', 'WORKER', 'Кварцевые часы', 1, 100, 100, '/images/underwear_worker.png'),
  ('SOCKS', 'WORKER', 'Чёрные носки', 5, 110, 5000, '/images/socks_worker.png'),
  ('SHOES', 'WORKER', 'Туфли', 12, 120, 12000, '/images/shoes_worker.png'),
  ('PANTS', 'WORKER', 'Брюки', 13, 150, 13000, '/images/pants_worker.png'),
  ('RING', 'WORKER', 'Печатка', 4, 130, 4000, '/images/ring_worker.png'),
  ('SHIRT', 'WORKER', 'Офисная рубашка', 14, 140, 15000, '/images/shirt_worker.png'),
  ('NECKLACE', 'WORKER', 'Белый воротничок', 16, 160, 16000, '/images/necklace_worker.png'),
  ('GLASSES', 'WORKER', 'Очки обыкновенные', 17, 180, 17000, '/images/glasses_worker.png'),
  ('CAP', 'WORKER', 'Лысина', 18, 200, 18000, '/images/cap_worker.png'),

  -- Мажор tier  
  ('UNDERWEAR', 'RICH', 'Rolex', 1, 1000, 10000, '/images/underwear_rich.png'),
  ('SOCKS', 'RICH', 'Инопланетные носки', 5, 1100, 500000, '/images/socks_rich.png'),
  ('SHOES', 'RICH', 'Кроссовки', 12, 1200, 1200000, '/images/shoes_rich.png'),
  ('PANTS', 'RICH', 'Джинсы', 13, 1500, 1300000, '/images/pants_rich.png'),
  ('RING', 'RICH', 'Кольцо с брильянтом 45 карат', 4, 1300, 400000, '/images/ring_rich.png'),
  ('SHIRT', 'RICH', 'Водолазка', 14, 1400, 1500000, '/images/shirt_rich.png'),
  ('NECKLACE', 'RICH', 'Золотая цепь', 16, 1600, 1600000, '/images/necklace_rich.png'),
  ('GLASSES', 'RICH', 'Солнцезащитные очки', 17, 1800, 1700000, '/images/glasses_rich.png'),
  ('CAP', 'RICH', 'Кепка с логотипом TON', 18, 2000, 1800000, '/images/cap_rich.png'),

  -- Дубайский Синагог tier
  ('UNDERWEAR', 'DUBAI_SYNAGOGUE', 'Часы Telegram', 1, 100000, 100000, '/images/underwear_dubai.png'),
  ('SOCKS', 'DUBAI_SYNAGOGUE', 'Носки Telegram', 5, 110000, 5000000, '/images/socks_dubai.png'),
  ('SHOES', 'DUBAI_SYNAGOGUE', 'Сапоги Telegram', 12, 12000, 12000000, '/images/shoes_dubai.png'),
  ('PANTS', 'DUBAI_SYNAGOGUE', 'Штаны как в Дюне', 13, 15000, 13000000, '/images/pants_dubai.png'),
  ('RING', 'DUBAI_SYNAGOGUE', 'Обручальное кольцо', 4, 13000, 4000000, '/images/ring_dubai.png'),
  ('SHIRT', 'DUBAI_SYNAGOGUE', 'Торс', 14, 14000, 15000000, '/images/shirt_dubai.png'),
  ('NECKLACE', 'DUBAI_SYNAGOGUE', 'Половая тряпка чёрного цвета', 16, 16000, 16000000, '/images/necklace_dubai.png'),
  ('GLASSES', 'DUBAI_SYNAGOGUE', 'Линзы', 17, 18000, 17000000, '/images/glasses_dubai.png'),
  ('CAP', 'DUBAI_SYNAGOGUE', 'Кипа', 18, 20000, 18000000, '/images/cap_dubai.png');