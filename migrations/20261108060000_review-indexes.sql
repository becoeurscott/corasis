-- Advisor review: index foreign keys used in lookups/cascades.
CREATE INDEX IF NOT EXISTS affections_sender_idx ON public.affections (sender_id);
CREATE INDEX IF NOT EXISTS invitations_accepted_by_idx ON public.invitations (accepted_by);
