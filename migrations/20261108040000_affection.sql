-- Affection: one-tap emojis sent to your partner (shown as a floating burst on
-- their screen, or as a push notification when the app is closed).
-- Clients go through the SECURITY DEFINER functions below.

CREATE TABLE public.affections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id uuid NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL CHECK (char_length(emoji) BETWEEN 1 AND 16),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX affections_couple_time_idx ON public.affections (couple_id, created_at DESC);

-- One row per device. environment: 'sandbox' (debug builds) or 'production' (TestFlight/App Store).
CREATE TABLE public.push_tokens (
  token text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL DEFAULT 'ios' CHECK (platform IN ('ios', 'android')),
  environment text NOT NULL DEFAULT 'production' CHECK (environment IN ('sandbox', 'production')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX push_tokens_user_idx ON public.push_tokens (user_id);

ALTER TABLE public.affections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.affections FROM anon, authenticated;
REVOKE ALL ON public.push_tokens FROM anon, authenticated;

-- Send an emoji to your partner. At most 30 per minute.
CREATE OR REPLACE FUNCTION public.send_affection(p_emoji text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  cid uuid;
  row affections;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in to send affection.'; END IF;
  SELECT id INTO cid FROM couples WHERE uid IN (member_a, member_b);
  IF cid IS NULL THEN RAISE EXCEPTION 'Connect with your partner first.'; END IF;
  IF (SELECT count(*) FROM affections WHERE sender_id = uid AND created_at > now() - interval '1 minute') >= 30 THEN
    RAISE EXCEPTION 'Slow down a little 💞';
  END IF;
  INSERT INTO affections (couple_id, sender_id, emoji) VALUES (cid, uid, p_emoji) RETURNING * INTO row;
  RETURN jsonb_build_object('id', row.id, 'emoji', row.emoji, 'created_at', row.created_at);
END $$;

-- Emojis your partner sent after p_since (newest last). Used to show the burst.
CREATE OR REPLACE FUNCTION public.received_affections(p_since timestamptz) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'emoji', a.emoji, 'created_at', a.created_at) ORDER BY a.created_at), '[]'::jsonb)
  FROM (
    SELECT a.* FROM affections a
    JOIN couples c ON c.id = a.couple_id
    WHERE auth.uid() IN (c.member_a, c.member_b)
      AND a.sender_id <> auth.uid()
      AND a.created_at > greatest(coalesce(p_since, now() - interval '1 day'), now() - interval '1 day')
    ORDER BY a.created_at DESC
    LIMIT 20
  ) a
$$;

-- Register this device for push notifications.
CREATE OR REPLACE FUNCTION public.save_push_token(p_token text, p_platform text, p_environment text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO push_tokens (token, user_id, platform, environment, updated_at)
  SELECT p_token, auth.uid(), p_platform, p_environment, now() WHERE auth.uid() IS NOT NULL
  ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform, environment = EXCLUDED.environment, updated_at = now()
$$;

-- Stop pushes to this device (sign out).
CREATE OR REPLACE FUNCTION public.remove_push_token(p_token text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM push_tokens WHERE token = p_token AND user_id = auth.uid()
$$;

-- For the affection-push edge function: only the sender may ask, and only
-- the partner's devices are returned, with the sender's first name.
CREATE OR REPLACE FUNCTION public.affection_push_targets(p_affection uuid) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT jsonb_build_object(
    'emoji', a.emoji,
    'sender_name', coalesce((SELECT first_name FROM profiles WHERE id = a.sender_id), 'Your partner'),
    'tokens', coalesce((SELECT jsonb_agg(jsonb_build_object('token', t.token, 'platform', t.platform, 'environment', t.environment))
                        FROM push_tokens t
                        WHERE t.user_id = CASE WHEN c.member_a = a.sender_id THEN c.member_b ELSE c.member_a END), '[]'::jsonb))
  FROM affections a JOIN couples c ON c.id = a.couple_id
  WHERE a.id = p_affection AND a.sender_id = auth.uid() AND a.created_at > now() - interval '5 minutes'
$$;

REVOKE ALL ON FUNCTION public.send_affection(text), public.received_affections(timestamptz), public.save_push_token(text, text, text), public.remove_push_token(text), public.affection_push_targets(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_affection(text), public.received_affections(timestamptz), public.save_push_token(text, text, text), public.remove_push_token(text), public.affection_push_targets(uuid) TO authenticated;
