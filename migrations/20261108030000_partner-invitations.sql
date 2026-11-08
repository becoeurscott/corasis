-- Partner invitations and couples, shared across phones.
-- Clients never touch these tables directly: everything goes through the
-- SECURITY DEFINER functions below, which check auth.uid() themselves.

CREATE TABLE public.invitations (
  code text PRIMARY KEY CHECK (code ~ '^[A-Z0-9]{8}$'),
  inviter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours'
);
CREATE INDEX invitations_inviter_idx ON public.invitations (inviter_id, status);

CREATE TABLE public.couples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_a uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_b uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  timezone text NOT NULL DEFAULT 'UTC',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (member_a <> member_b)
);
CREATE UNIQUE INDEX couples_member_a_uniq ON public.couples (member_a);
CREATE UNIQUE INDEX couples_member_b_uniq ON public.couples (member_b);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couples ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.invitations FROM anon, authenticated;
REVOKE ALL ON public.couples FROM anon, authenticated;

-- Partners may read each other's profile (name, photo, time zone).
CREATE POLICY profiles_select_partner ON public.profiles FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.couples c
          WHERE (c.member_a = (SELECT auth.uid()) AND c.member_b = profiles.id)
             OR (c.member_b = (SELECT auth.uid()) AND c.member_a = profiles.id))
);

-- The caller's couple with the partner's public profile, or null.
CREATE OR REPLACE FUNCTION public.my_couple() RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT jsonb_build_object(
    'couple_id', c.id, 'timezone', c.timezone, 'created_at', c.created_at,
    'partner', jsonb_build_object('id', p.id, 'first_name', coalesce(p.first_name, 'Partner'),
                                  'timezone', coalesce(p.timezone, 'UTC'), 'avatar_url', p.avatar_url))
  FROM couples c
  LEFT JOIN profiles p ON p.id = CASE WHEN c.member_a = auth.uid() THEN c.member_b ELSE c.member_a END
  WHERE auth.uid() IN (c.member_a, c.member_b)
  LIMIT 1
$$;

-- New 8-character code for the caller; older pending codes are revoked.
CREATE OR REPLACE FUNCTION public.create_invitation() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  new_code text;
  inv invitations;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in to invite your partner.'; END IF;
  IF EXISTS (SELECT 1 FROM couples WHERE uid IN (member_a, member_b)) THEN
    RAISE EXCEPTION 'You are already connected with a partner.';
  END IF;
  UPDATE invitations SET status = 'revoked' WHERE inviter_id = uid AND status = 'pending';
  LOOP
    new_code := '';
    FOR i IN 1..8 LOOP
      new_code := new_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM invitations WHERE code = new_code);
  END LOOP;
  INSERT INTO invitations (code, inviter_id) VALUES (new_code, uid) RETURNING * INTO inv;
  RETURN jsonb_build_object('code', inv.code, 'expires_at', inv.expires_at);
END $$;

-- Redeem a partner's code: creates the couple and returns it like my_couple().
CREATE OR REPLACE FUNCTION public.accept_invitation(p_code text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  inv invitations;
  tz text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in to connect with your partner.'; END IF;
  SELECT * INTO inv FROM invitations WHERE code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')) FOR UPDATE;
  IF inv.code IS NULL OR inv.status <> 'pending' OR inv.expires_at < now() THEN
    RAISE EXCEPTION 'That code is not valid or has expired. Ask your partner for a new one.';
  END IF;
  IF inv.inviter_id = uid THEN RAISE EXCEPTION 'That is your own code. Send it to your partner instead.'; END IF;
  IF EXISTS (SELECT 1 FROM couples WHERE uid IN (member_a, member_b)) THEN
    RAISE EXCEPTION 'You are already connected with a partner.';
  END IF;
  IF EXISTS (SELECT 1 FROM couples WHERE inv.inviter_id IN (member_a, member_b)) THEN
    RAISE EXCEPTION 'Your partner is already connected with someone.';
  END IF;
  SELECT coalesce(timezone, 'UTC') INTO tz FROM profiles WHERE id = inv.inviter_id;
  INSERT INTO couples (member_a, member_b, timezone) VALUES (inv.inviter_id, uid, coalesce(tz, 'UTC'));
  UPDATE invitations SET status = 'accepted', accepted_by = uid WHERE code = inv.code;
  UPDATE invitations SET status = 'revoked' WHERE inviter_id = uid AND status = 'pending';
  RETURN public.my_couple();
END $$;

-- Either partner can unlink.
CREATE OR REPLACE FUNCTION public.unlink_couple() RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM couples WHERE auth.uid() IN (member_a, member_b)
$$;

REVOKE ALL ON FUNCTION public.my_couple(), public.create_invitation(), public.accept_invitation(text), public.unlink_couple() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_couple(), public.create_invitation(), public.accept_invitation(text), public.unlink_couple() TO authenticated;
