-- ЯДЕРНЫЙ ВАРИАНТ - удаляет ВСЁ из схемы public
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

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
  'JEW' -- дубайский синагой
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
  referred_by UUID,  -- Убираем REFERENCES пока
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
  ('UNDERWEAR', 'POOR', 'Рваные трусы', 1, 0, 1, '/images/underwear_poor.png'),
  ('SOCKS', 'POOR', 'Дырявые носки', 5, 1, 50, '/images/socks_poor.png'),
  ('SHOES', 'POOR', 'Стоптанные кроссовки', 12, 2, 120, '/images/shoes_poor.png'),
  ('PANTS', 'POOR', 'Потертые джинсы', 13, 5, 130, '/images/pants_poor.png'),
  ('RING', 'POOR', 'Пластырь', 4, 3, 40, '/images/ring_poor.png'),
  ('SHIRT', 'POOR', 'Застиранная футболка', 14, 4, 150, '/images/shirt_poor.png'),
  ('NECKLACE', 'POOR', 'Цепочка из проволоки', 16, 6, 160, '/images/necklace_poor.png'),
  ('GLASSES', 'POOR', 'Разбитые очки', 17, 8, 170, '/images/glasses_poor.png'),
  ('CAP', 'POOR', 'Шапка бомжа', 18, 10, 180, '/images/cap_poor.png'),

  -- Работяга tier
  ('UNDERWEAR', 'WORKER', 'Семейники', 1, 100, 100, '/images/underwear_worker.png'),
  ('SOCKS', 'WORKER', 'Носки с рынка', 5, 110, 5000, '/images/socks_worker.png'),
  ('SHOES', 'WORKER', 'Туфли', 12, 120, 12000, '/images/shoes_worker.png'),
  ('PANTS', 'WORKER', 'Брюки', 13, 150, 13000, '/images/pants_worker.png'),
  ('RING', 'WORKER', 'Печатка', 4, 130, 4000, '/images/ring_worker.png'),
  ('SHIRT', 'WORKER', 'Офисная рубашка', 14, 140, 15000, '/images/shirt_worker.png'),
  ('NECKLACE', 'WORKER', 'Белый воротничок', 16, 160, 16000, '/images/necklace_worker.png'),
  ('GLASSES', 'WORKER', 'Очки обыкновенные', 17, 180, 17000, '/images/glasses_worker.png'),
  ('CAP', 'WORKER', 'Лысина', 18, 200, 18000, '/images/cap_worker.png'),

  -- Мажор tier  
  ('UNDERWEAR', 'RICH', 'Стринги', 1, 1000, 10000, '/images/underwear_rich.png'),
  ('SOCKS', 'RICH', 'Чёрные носки', 5, 1100, 500000, '/images/socks_rich.png'),
  ('SHOES', 'RICH', 'Кроссовки', 12, 1200, 1200000, '/images/shoes_rich.png'),
  ('PANTS', 'RICH', 'Джинсы', 13, 1500, 1300000, '/images/pants_rich.png'),
  ('RING', 'RICH', 'Кольцо с брильянтом 45 карат', 4, 1300, 400000, '/images/ring_rich.png'),
  ('SHIRT', 'RICH', 'Водолазка', 14, 1400, 1500000, '/images/shirt_rich.png'),
  ('NECKLACE', 'RICH', 'Золотая цепь', 16, 1600, 1600000, '/images/necklace_rich.png'),
  ('GLASSES', 'RICH', 'Солнцезащитные очки', 17, 1800, 1700000, '/images/glasses_rich.png'),
  ('CAP', 'RICH', 'Кепка с логотипом TON', 18, 2000, 1800000, '/images/cap_rich.png'),

  -- Дубайский Синагог tier
  ('UNDERWEAR', 'JEW', 'Ректальный ускоритиель', 1, 100000, 100000, '/images/underwear_jew.png'),
  ('SOCKS', 'JEW', 'Носки из волос девственниц', 5, 110000, 5000000, '/images/socks_jew.png'),
  ('SHOES', 'JEW', 'Говнодавы по колено', 12, 12000, 12000000, '/images/shoes_jew.png'),
  ('PANTS', 'JEW', 'Штаны как в Дюне', 13, 15000, 13000000, '/images/pants_jew.png'),
  ('RING', 'JEW', 'Обручальное кольцо', 4, 13000, 4000000, '/images/ring_jew.png'),
  ('SHIRT', 'JEW', 'Охуительный торс', 14, 14000, 15000000, '/images/shirt_jew.png'),
  ('NECKLACE', 'JEW', 'Половая тряпка чёрного цвета', 16, 16000, 16000000, '/images/necklace_jew.png'),
  ('GLASSES', 'JEW', 'Линзы', 17, 18000, 17000000, '/images/glasses_jew.png'),
  ('CAP', 'JEW', 'Кипа', 18, 20000, 18000000, '/images/cap_jew.png');