-- Remove localStorage dependency for "jobs" tab:
-- persist catalog and user progress in Supabase.

CREATE TABLE IF NOT EXISTS public.work_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  unlock_price INTEGER NOT NULL CHECK (unlock_price >= 0),
  profit_per_hour INTEGER NOT NULL CHECK (profit_per_hour >= 0),
  image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_work_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  work_card_id UUID NOT NULL REFERENCES public.work_cards(id) ON DELETE CASCADE,
  purchased_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_claim_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  total_earned INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, work_card_id)
);

CREATE INDEX IF NOT EXISTS idx_work_cards_sort_order ON public.work_cards(sort_order);
CREATE INDEX IF NOT EXISTS idx_user_work_cards_user_id ON public.user_work_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_user_work_cards_work_card_id ON public.user_work_cards(work_card_id);

ALTER TABLE public.work_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_work_cards ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'work_cards' AND policyname = 'Anyone can view work cards'
  ) THEN
    CREATE POLICY "Anyone can view work cards" ON public.work_cards
      FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_work_cards' AND policyname = 'Public can manage user work cards'
  ) THEN
    CREATE POLICY "Public can manage user work cards" ON public.user_work_cards
      FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'work_cards' AND policyname = 'service_role_bypass_work_cards'
  ) THEN
    CREATE POLICY "service_role_bypass_work_cards" ON public.work_cards
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_work_cards' AND policyname = 'service_role_bypass_user_work_cards'
  ) THEN
    CREATE POLICY "service_role_bypass_user_work_cards" ON public.user_work_cards
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON public.work_cards TO service_role;
GRANT ALL ON public.user_work_cards TO service_role;

INSERT INTO public.work_cards (code, title, description, unlock_price, profit_per_hour, image_url, sort_order, is_active)
VALUES
  ('memes_factory', 'Мемы Factory', 'Делаешь мемы в Telegram-сетке', 150, 20, '/works/card1.png', 1, true),
  ('copywriter_ai', 'AI Copywriter', 'Пишешь посты и прогреваешь трафик', 500, 75, '/works/card2.png', 2, true),
  ('traffic_farmer', 'Traffic Farmer', 'Льешь подписчиков в Telegram-каналы', 1200, 180, '/works/card3.png', 3, true),
  ('crypto_trader', 'Crypto Trader', 'Арбитраж и сделки на новостях', 3000, 480, '/works/card4.png', 4, true)
ON CONFLICT (code) DO UPDATE
SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  unlock_price = EXCLUDED.unlock_price,
  profit_per_hour = EXCLUDED.profit_per_hour,
  image_url = EXCLUDED.image_url,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;
