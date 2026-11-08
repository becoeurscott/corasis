CREATE TABLE public.connection_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version = 1),
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT connection_answers_valid CHECK (
    jsonb_typeof(answers) = 'object'
    AND answers - ARRAY['focus', 'challenge', 'affection', 'daily_time', 'pace']::text[] = '{}'::jsonb
    AND (NOT (answers ? 'focus') OR (jsonb_typeof(answers->'focus') = 'string' AND answers->>'focus' IN ('daily_connection', 'deeper_conversations', 'playful_moments', 'planning_visits', 'appreciation')))
    AND (NOT (answers ? 'challenge') OR (jsonb_typeof(answers->'challenge') = 'string' AND answers->>'challenge' IN ('busy_days', 'time_zones', 'same_conversations', 'finding_words', 'exploring')))
    AND (NOT (answers ? 'affection') OR (jsonb_typeof(answers->'affection') = 'string' AND answers->>'affection' IN ('words', 'photos', 'quality_time', 'play', 'plans')))
    AND (NOT (answers ? 'daily_time') OR (jsonb_typeof(answers->'daily_time') = 'string' AND answers->>'daily_time' IN ('two_minutes', 'five_minutes', 'ten_minutes', 'flexible')))
    AND (NOT (answers ? 'pace') OR (jsonb_typeof(answers->'pace') = 'string' AND answers->>'pace' IN ('gentle', 'playful', 'thoughtful')))
  )
);
ALTER TABLE public.connection_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.connection_preferences FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.connection_preferences TO authenticated;
CREATE POLICY connection_preferences_select ON public.connection_preferences FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY connection_preferences_insert ON public.connection_preferences FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY connection_preferences_update ON public.connection_preferences FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY connection_preferences_delete ON public.connection_preferences FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE TRIGGER connection_preferences_updated_at BEFORE UPDATE ON public.connection_preferences FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();
