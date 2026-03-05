-- In-app stars transfer between users (by telegram_id)

CREATE TABLE IF NOT EXISTS public.star_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  recipient_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  amount INTEGER NOT NULL CHECK (amount > 0),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_star_transfers_sender_user_id ON public.star_transfers(sender_user_id);
CREATE INDEX IF NOT EXISTS idx_star_transfers_recipient_user_id ON public.star_transfers(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_star_transfers_created_at ON public.star_transfers(created_at DESC);

ALTER TABLE public.star_transfers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'star_transfers'
      AND policyname = 'service_role_bypass_star_transfers'
  ) THEN
    CREATE POLICY "service_role_bypass_star_transfers" ON public.star_transfers
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON public.star_transfers TO service_role;

CREATE OR REPLACE FUNCTION public.transfer_stars(
  p_sender_telegram_id TEXT,
  p_recipient_telegram_id TEXT,
  p_amount INTEGER,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_id UUID;
  v_recipient_id UUID;
  v_sender_stars INTEGER;
  v_recipient_stars INTEGER;
  v_transfer_id UUID;
BEGIN
  IF p_sender_telegram_id IS NULL OR p_sender_telegram_id = '' THEN
    RAISE EXCEPTION 'SENDER_TELEGRAM_ID_REQUIRED';
  END IF;

  IF p_recipient_telegram_id IS NULL OR p_recipient_telegram_id = '' THEN
    RAISE EXCEPTION 'RECIPIENT_TELEGRAM_ID_REQUIRED';
  END IF;

  IF p_sender_telegram_id = p_recipient_telegram_id THEN
    RAISE EXCEPTION 'CANNOT_TRANSFER_TO_SELF';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_TRANSFER_AMOUNT';
  END IF;

  SELECT id, stars
    INTO v_sender_id, v_sender_stars
  FROM public.users
  WHERE telegram_id = p_sender_telegram_id
  FOR UPDATE;

  IF v_sender_id IS NULL THEN
    RAISE EXCEPTION 'SENDER_NOT_FOUND';
  END IF;

  SELECT id, stars
    INTO v_recipient_id, v_recipient_stars
  FROM public.users
  WHERE telegram_id = p_recipient_telegram_id
  FOR UPDATE;

  IF v_recipient_id IS NULL THEN
    RAISE EXCEPTION 'RECIPIENT_NOT_FOUND';
  END IF;

  IF v_sender_stars < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_STARS';
  END IF;

  UPDATE public.users
  SET stars = stars - p_amount
  WHERE id = v_sender_id;

  UPDATE public.users
  SET stars = stars + p_amount
  WHERE id = v_recipient_id;

  INSERT INTO public.star_transfers (sender_user_id, recipient_user_id, amount, note)
  VALUES (v_sender_id, v_recipient_id, p_amount, NULLIF(p_note, ''))
  RETURNING id INTO v_transfer_id;

  RETURN jsonb_build_object(
    'success', true,
    'transfer_id', v_transfer_id,
    'sender_stars', v_sender_stars - p_amount,
    'recipient_stars', v_recipient_stars + p_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_stars(TEXT, TEXT, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transfer_stars(TEXT, TEXT, INTEGER, TEXT) TO anon, authenticated, service_role;
