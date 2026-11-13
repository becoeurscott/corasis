-- New games (Love Duels, Draw & Guess, Two Halves) sync as 'play' items,
-- and "your move" nudges reuse partner alerts with kind 'turn' (place = game name).
ALTER TABLE public.couple_items DROP CONSTRAINT IF EXISTS couple_items_kind_check;
ALTER TABLE public.couple_items ADD CONSTRAINT couple_items_kind_check
  CHECK (kind IN ('moment','message','session','memory','event','life','couple','widget','checkup','truths','place','repair','play'));
ALTER TABLE public.partner_alerts DROP CONSTRAINT IF EXISTS partner_alerts_kind_check;
ALTER TABLE public.partner_alerts ADD CONSTRAINT partner_alerts_kind_check CHECK (kind IN ('arrive','leave','near','repair','turn'));
