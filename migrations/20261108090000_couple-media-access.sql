-- Fix: storage rules for couple-media checked public.couples directly, but
-- that table is locked for app users, so every upload/download was refused
-- (403). Do the membership check in a function that can read couples.

CREATE OR REPLACE FUNCTION public.is_couple_member(p_couple text) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM couples c WHERE c.id::text = p_couple AND auth.uid() IN (c.member_a, c.member_b))
$$;
REVOKE ALL ON FUNCTION public.is_couple_member(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_couple_member(text) TO authenticated;

DROP POLICY IF EXISTS couple_media_select ON storage.objects;
DROP POLICY IF EXISTS couple_media_insert ON storage.objects;
CREATE POLICY couple_media_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket = 'couple-media' AND public.is_couple_member((storage.foldername(key))[1]));
CREATE POLICY couple_media_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket = 'couple-media' AND uploaded_by = (SELECT auth.jwt() ->> 'sub') AND public.is_couple_member((storage.foldername(key))[1]));

-- Same for the (defence-in-depth) read rule on couple_items.
DROP POLICY IF EXISTS couple_items_member_select ON public.couple_items;
CREATE POLICY couple_items_member_select ON public.couple_items FOR SELECT TO authenticated
  USING (public.is_couple_member(couple_id::text));
