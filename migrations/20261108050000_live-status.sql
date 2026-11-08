-- Live status shared between partners: location (for the flag + distance)
-- and battery. Each person decides what they share; values are cleared the
-- moment they turn a switch off. Only the partner can read it.

CREATE TABLE public.live_status (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  share_location boolean NOT NULL DEFAULT false,
  share_battery boolean NOT NULL DEFAULT false,
  lat double precision,
  lon double precision,
  country text,
  country_code text CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$'),
  location_at timestamptz,
  battery integer CHECK (battery IS NULL OR battery BETWEEN 0 AND 100),
  battery_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (share_location OR (lat IS NULL AND lon IS NULL AND country_code IS NULL)),
  CHECK (share_battery OR battery IS NULL)
);
ALTER TABLE public.live_status ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.live_status FROM anon, authenticated;

-- Save my switches and current values. Values you don't share are wiped;
-- passing null for a shared value keeps the last known one.
CREATE OR REPLACE FUNCTION public.update_live_status(
  p_share_location boolean, p_share_battery boolean,
  p_lat double precision DEFAULT NULL, p_lon double precision DEFAULT NULL,
  p_country text DEFAULT NULL, p_country_code text DEFAULT NULL, p_battery integer DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in first.'; END IF;
  INSERT INTO live_status AS l (user_id, share_location, share_battery, lat, lon, country, country_code, location_at, battery, battery_at, updated_at)
  VALUES (uid, p_share_location, p_share_battery,
          CASE WHEN p_share_location THEN p_lat END, CASE WHEN p_share_location THEN p_lon END,
          CASE WHEN p_share_location THEN p_country END, CASE WHEN p_share_location THEN upper(p_country_code) END,
          CASE WHEN p_share_location AND p_lat IS NOT NULL THEN now() END,
          CASE WHEN p_share_battery THEN p_battery END, CASE WHEN p_share_battery AND p_battery IS NOT NULL THEN now() END, now())
  ON CONFLICT (user_id) DO UPDATE SET
    share_location = EXCLUDED.share_location,
    share_battery = EXCLUDED.share_battery,
    lat = CASE WHEN NOT EXCLUDED.share_location THEN NULL ELSE coalesce(EXCLUDED.lat, l.lat) END,
    lon = CASE WHEN NOT EXCLUDED.share_location THEN NULL ELSE coalesce(EXCLUDED.lon, l.lon) END,
    country = CASE WHEN NOT EXCLUDED.share_location THEN NULL ELSE coalesce(EXCLUDED.country, l.country) END,
    country_code = CASE WHEN NOT EXCLUDED.share_location THEN NULL ELSE coalesce(EXCLUDED.country_code, l.country_code) END,
    location_at = CASE WHEN NOT EXCLUDED.share_location THEN NULL ELSE coalesce(EXCLUDED.location_at, l.location_at) END,
    battery = CASE WHEN NOT EXCLUDED.share_battery THEN NULL ELSE coalesce(EXCLUDED.battery, l.battery) END,
    battery_at = CASE WHEN NOT EXCLUDED.share_battery THEN NULL ELSE coalesce(EXCLUDED.battery_at, l.battery_at) END,
    updated_at = now();
END $$;

-- My partner's shared status (null if not connected or nothing saved yet).
CREATE OR REPLACE FUNCTION public.partner_live_status() RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT jsonb_build_object(
    'user_id', l.user_id, 'share_location', l.share_location, 'share_battery', l.share_battery,
    'lat', l.lat, 'lon', l.lon, 'country', l.country, 'country_code', l.country_code, 'location_at', l.location_at,
    'battery', l.battery, 'battery_at', l.battery_at)
  FROM couples c
  JOIN live_status l ON l.user_id = CASE WHEN c.member_a = auth.uid() THEN c.member_b ELSE c.member_a END
  WHERE auth.uid() IN (c.member_a, c.member_b)
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.update_live_status(boolean, boolean, double precision, double precision, text, text, integer), public.partner_live_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_live_status(boolean, boolean, double precision, double precision, text, text, integer), public.partner_live_status() TO authenticated;
