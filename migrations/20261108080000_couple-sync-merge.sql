-- Answers and reactions belong to whoever wrote them: when a phone saves a
-- session or message, only the caller's own submission/reaction is taken
-- from the new copy; the partner's stay as stored. Stops a stale copy from
-- erasing the partner's answer, and stops anyone writing the partner's answer.

CREATE OR REPLACE FUNCTION public.merge_own_entries(old_data jsonb, new_data jsonb, uid uuid) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
  SELECT new_data
    || CASE WHEN new_data ? 'submissions' OR old_data ? 'submissions' THEN jsonb_build_object('submissions', coalesce((
         SELECT jsonb_agg(s) FROM (
           SELECT s FROM jsonb_array_elements(coalesce(old_data->'submissions', '[]')) s WHERE s->>'userId' <> uid::text
           UNION ALL
           SELECT s FROM jsonb_array_elements(coalesce(new_data->'submissions', '[]')) s WHERE s->>'userId' = uid::text
         ) x), '[]'::jsonb)) ELSE '{}'::jsonb END
    || CASE WHEN new_data ? 'reactions' OR old_data ? 'reactions' THEN jsonb_build_object('reactions',
         (SELECT coalesce(jsonb_object_agg(k, v), '{}'::jsonb) FROM jsonb_each(coalesce(old_data->'reactions', '{}')) e(k, v) WHERE k <> uid::text)
         || CASE WHEN new_data->'reactions' ? uid::text THEN jsonb_build_object(uid::text, new_data->'reactions'->uid::text) ELSE '{}'::jsonb END)
       ELSE '{}'::jsonb END
$$;

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
      SET data = CASE WHEN ci.kind IN ('session', 'message') THEN merge_own_entries(ci.data, EXCLUDED.data, uid) ELSE EXCLUDED.data END,
          deleted = EXCLUDED.deleted, updated_by = uid, updated_at = clock_timestamp();
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
