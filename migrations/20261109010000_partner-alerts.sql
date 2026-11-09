-- Place alerts (arrive/leave a saved place) and proximity alerts ("you're close").
-- A phone that detects the event calls send_partner_alert; the partner-alert-push
-- edge function then pushes it to the partner's devices.

CREATE TABLE public.partner_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id uuid NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('arrive', 'leave', 'near')),
  place text CHECK (place IS NULL OR char_length(place) <= 60),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX partner_alerts_couple_time_idx ON public.partner_alerts (couple_id, created_at DESC);
ALTER TABLE public.partner_alerts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.partner_alerts FROM anon, authenticated;

-- Returns the new alert id, or NULL when it was a duplicate (a "near" alert is
-- sent at most once every 2 hours per couple, place alerts at most 20 an hour).
CREATE OR REPLACE FUNCTION public.send_partner_alert(p_kind text, p_place text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); cid uuid; new_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in first.'; END IF;
  SELECT id INTO cid FROM couples WHERE uid IN (member_a, member_b);
  IF cid IS NULL THEN RETURN NULL; END IF;
  IF p_kind = 'near' AND EXISTS (SELECT 1 FROM partner_alerts WHERE couple_id = cid AND kind = 'near' AND created_at > now() - interval '2 hours') THEN RETURN NULL; END IF;
  IF (SELECT count(*) FROM partner_alerts WHERE sender_id = uid AND created_at > now() - interval '1 hour') >= 20 THEN RETURN NULL; END IF;
  INSERT INTO partner_alerts (couple_id, sender_id, kind, place) VALUES (cid, uid, p_kind, left(p_place, 60)) RETURNING id INTO new_id;
  RETURN new_id;
END $$;

-- For the edge function. "near" goes to both spouses; place alerts to the partner only.
CREATE OR REPLACE FUNCTION public.partner_alert_push_targets(p_alert uuid) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT jsonb_build_object(
    'kind', a.kind, 'place', a.place,
    'sender_name', coalesce((SELECT first_name FROM profiles WHERE id = a.sender_id), 'Your partner'),
    'partner_name', coalesce((SELECT first_name FROM profiles WHERE id = CASE WHEN c.member_a = a.sender_id THEN c.member_b ELSE c.member_a END), 'Your partner'),
    'tokens', coalesce((SELECT jsonb_agg(jsonb_build_object('token', t.token, 'platform', t.platform, 'environment', t.environment, 'self', t.user_id = a.sender_id))
                        FROM push_tokens t
                        WHERE t.user_id = CASE WHEN c.member_a = a.sender_id THEN c.member_b ELSE c.member_a END
                           OR (a.kind = 'near' AND t.user_id = a.sender_id)), '[]'::jsonb))
  FROM partner_alerts a JOIN couples c ON c.id = a.couple_id
  WHERE a.id = p_alert AND a.sender_id = auth.uid() AND a.created_at > now() - interval '5 minutes'
$$;

REVOKE ALL ON FUNCTION public.send_partner_alert(text, text), public.partner_alert_push_targets(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_partner_alert(text, text), public.partner_alert_push_targets(uuid) TO authenticated;
