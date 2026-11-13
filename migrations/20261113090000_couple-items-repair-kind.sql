-- Allow Mend the Heart ("repair") items in couple_items.
ALTER TABLE public.couple_items
  DROP CONSTRAINT IF EXISTS couple_items_kind_check;

ALTER TABLE public.couple_items
  ADD CONSTRAINT couple_items_kind_check
    CHECK (kind IN ('moment', 'message', 'session', 'memory', 'event', 'life', 'couple', 'widget', 'checkup', 'truths', 'place', 'repair'));
