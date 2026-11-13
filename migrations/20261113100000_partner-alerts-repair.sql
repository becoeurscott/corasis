-- "Mend the Heart" invitations reuse partner alerts: kind 'repair', place = the topic.
ALTER TABLE public.partner_alerts DROP CONSTRAINT IF EXISTS partner_alerts_kind_check;
ALTER TABLE public.partner_alerts ADD CONSTRAINT partner_alerts_kind_check CHECK (kind IN ('arrive', 'leave', 'near', 'repair'));
