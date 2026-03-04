-- Rewards, pricing, and bootstrap stars

-- 1) Ensure reward claims table exists
CREATE TABLE IF NOT EXISTS channel_reward_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_username TEXT NOT NULL,
  stars_awarded INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, channel_username)
);

CREATE INDEX IF NOT EXISTS idx_channel_reward_claims_user_id ON channel_reward_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_channel_reward_claims_channel_username ON channel_reward_claims(channel_username);

ALTER TABLE channel_reward_claims ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'channel_reward_claims'
      AND policyname = 'service_role_bypass_channel_reward_claims'
  ) THEN
    CREATE POLICY "service_role_bypass_channel_reward_claims" ON channel_reward_claims
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON channel_reward_claims TO service_role;

-- 2) Rename items in requested categories (enum-safe across JEW / DUBAI_SYNAGOGUE)
UPDATE items SET name = 'Часы с рынка' WHERE type = 'UNDERWEAR' AND tier::text = 'POOR';
UPDATE items SET name = 'Кварцевые часы' WHERE type = 'UNDERWEAR' AND tier::text = 'WORKER';
UPDATE items SET name = 'Rolex' WHERE type = 'UNDERWEAR' AND tier::text = 'RICH';
UPDATE items SET name = 'Часы Telegram' WHERE type = 'UNDERWEAR' AND tier::text IN ('JEW', 'DUBAI_SYNAGOGUE');

UPDATE items SET name = 'Носки с рынка' WHERE type = 'SOCKS' AND tier::text = 'POOR';
UPDATE items SET name = 'Чёрные носки' WHERE type = 'SOCKS' AND tier::text = 'WORKER';
UPDATE items SET name = 'Инопланетные носки' WHERE type = 'SOCKS' AND tier::text = 'RICH';
UPDATE items SET name = 'Носки Telegram' WHERE type = 'SOCKS' AND tier::text IN ('JEW', 'DUBAI_SYNAGOGUE');

UPDATE items SET name = 'Сапоги Telegram' WHERE type = 'SHOES' AND tier::text IN ('JEW', 'DUBAI_SYNAGOGUE');
UPDATE items SET name = 'Торс' WHERE type = 'SHIRT' AND tier::text IN ('JEW', 'DUBAI_SYNAGOGUE');

-- 3) Temporary prices: all items = 1 star
UPDATE items SET price = 1;

-- 4) Bootstrap first player balance
INSERT INTO users (telegram_id, stars)
VALUES ('6610356259', 1100000)
ON CONFLICT (telegram_id)
DO UPDATE SET stars = 1100000, updated_at = now();
