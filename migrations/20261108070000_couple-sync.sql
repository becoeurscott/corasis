-- Couple sync: everything a couple shares (moments, messages, question
-- sessions, memories, calendar, baby game, couple settings, widget note)
-- lives in one table of JSON records, one row per item, so both phones (iOS
-- and Android) see the same data. Formats are documented in docs/SYNC.md.
-- Photos/videos/voice notes go to the private couple-media bucket under
-- <couple_id>/..., readable only by the two partners.

CREATE TABLE public.couple_items (
  couple_id uuid NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('moment', 'message', 'session', 'memory', 'event', 'life', 'couple', 'widget')),
  id text NOT NULL CHECK (char_length(id) BETWEEN 1 AND 120),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(data) = 'object' AND pg_column_size(data) < 200000),
  deleted boolean NOT NULL DEFAULT false,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (couple_id, kind, id)
);
CREATE INDEX couple_items_changes_idx ON public.couple_items (couple_id, updated_at);
CREATE INDEX couple_items_author_idx ON public.couple_items (author_id);
CREATE INDEX couple_items_updated_by_idx ON public.couple_items (updated_by);

ALTER TABLE public.couple_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.couple_items FROM anon, authenticated;
-- Members can read their couple's rows (defence in depth; apps use the function below).
CREATE POLICY couple_items_member_select ON public.couple_items FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.couples c WHERE c.id = couple_items.couple_id AND (SELECT auth.uid()) IN (c.member_a, c.member_b))
);

-- One round trip: save my changed items, get everything that changed since p_since.
-- p_items: [{kind, id, data, deleted}]. p_since null = full download (new phone).
CREATE OR REPLACE FUNCTION public.sync_couple_items(p_items jsonb, p_since timestamptz) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  cid uuid;
  it jsonb;
  out jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in first.'; END IF;
  SELECT id INTO cid FROM couples WHERE uid IN (member_a, member_b);
  IF cid IS NULL THEN RETURN jsonb_build_object('couple_id', NULL, 'items', '[]'::jsonb, 'more', false); END IF;
  IF jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' OR jsonb_array_length(coalesce(p_items, '[]'::jsonb)) > 200 THEN
    RAISE EXCEPTION 'Send at most 200 items at a time.';
  END IF;

  FOR it IN SELECT * FROM jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) LOOP
    INSERT INTO couple_items AS ci (couple_id, kind, id, author_id, data, deleted, updated_by, updated_at)
    VALUES (cid, it->>'kind', it->>'id', uid, coalesce(it->'data', '{}'::jsonb), coalesce((it->>'deleted')::boolean, false), uid, clock_timestamp())
    ON CONFLICT (couple_id, kind, id) DO UPDATE
      SET data = EXCLUDED.data, deleted = EXCLUDED.deleted, updated_by = uid, updated_at = clock_timestamp();
  END LOOP;

  SELECT coalesce(jsonb_agg(jsonb_build_object('kind', x.kind, 'id', x.id, 'author_id', x.author_id, 'data', x.data,
                                               'deleted', x.deleted, 'updated_at', x.updated_at) ORDER BY x.updated_at), '[]'::jsonb)
    INTO out
  FROM (
    SELECT * FROM couple_items
    WHERE couple_id = cid
      AND (p_since IS NULL OR (updated_at > p_since AND updated_by IS DISTINCT FROM uid))
    ORDER BY updated_at
    LIMIT 500
  ) x;
  RETURN jsonb_build_object('couple_id', cid, 'items', out, 'more', jsonb_array_length(out) = 500);
END $$;

REVOKE ALL ON FUNCTION public.sync_couple_items(jsonb, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_couple_items(jsonb, timestamptz) TO authenticated;

-- Private media bucket: only the two partners can read/write <couple_id>/...
-- (bucket created with: insforge storage create-bucket couple-media --private)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
-- The default "upload as yourself" rule allowed any bucket; keep it for other
-- buckets so couple-media only accepts uploads from the couple's two members.
DROP POLICY IF EXISTS storage_objects_owner_insert ON storage.objects;
CREATE POLICY storage_objects_owner_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket <> 'couple-media' AND uploaded_by = (SELECT auth.jwt() ->> 'sub'));
CREATE POLICY couple_media_select ON storage.objects FOR SELECT TO authenticated USING (
  bucket = 'couple-media' AND EXISTS (
    SELECT 1 FROM public.couples c
    WHERE c.id::text = (storage.foldername(key))[1] AND (SELECT auth.uid()) IN (c.member_a, c.member_b))
);
CREATE POLICY couple_media_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket = 'couple-media' AND uploaded_by = (SELECT auth.jwt() ->> 'sub') AND EXISTS (
    SELECT 1 FROM public.couples c
    WHERE c.id::text = (storage.foldername(key))[1] AND (SELECT auth.uid()) IN (c.member_a, c.member_b))
);
