CREATE TYPE public.loop_status AS ENUM ('open','matched','cancelled','expired','completed');

CREATE TABLE public.loop_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  subject text NOT NULL,
  grade_level text,
  topic text,
  duration_minutes integer NOT NULL DEFAULT 30,
  start_mode text NOT NULL DEFAULT 'now',
  preferred_start timestamptz,
  notes text,
  status public.loop_status NOT NULL DEFAULT 'open',
  tutor_id uuid,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  rating smallint,
  rating_comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.loop_requests TO authenticated;
GRANT ALL ON public.loop_requests TO service_role;
ALTER TABLE public.loop_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students see own loop requests" ON public.loop_requests FOR SELECT TO authenticated
  USING (auth.uid() = student_id OR auth.uid() = tutor_id OR private.has_role(auth.uid(),'admin'));
CREATE POLICY "Tutors see open loop requests" ON public.loop_requests FOR SELECT TO authenticated
  USING (status = 'open' AND (private.has_role(auth.uid(),'tutor') OR private.has_role(auth.uid(),'admin')));
CREATE POLICY "Students create loop requests" ON public.loop_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Students update own loop requests" ON public.loop_requests FOR UPDATE TO authenticated
  USING (auth.uid() = student_id) WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Tutors claim open loop requests" ON public.loop_requests FOR UPDATE TO authenticated
  USING (
    (status = 'open' AND (private.has_role(auth.uid(),'tutor') OR private.has_role(auth.uid(),'admin')))
    OR auth.uid() = tutor_id
  )
  WITH CHECK (auth.uid() = tutor_id OR private.has_role(auth.uid(),'admin'));
CREATE POLICY "Students delete own loop requests" ON public.loop_requests FOR DELETE TO authenticated
  USING (auth.uid() = student_id OR private.has_role(auth.uid(),'admin'));

CREATE TRIGGER loop_requests_set_updated_at BEFORE UPDATE ON public.loop_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX loop_requests_status_idx ON public.loop_requests (status, created_at DESC);

CREATE OR REPLACE FUNCTION public.claim_loop_request(_request_id uuid)
RETURNS public.loop_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.loop_requests;
BEGIN
  IF NOT (private.has_role(auth.uid(),'tutor') OR private.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Only tutors can accept Loop requests';
  END IF;

  UPDATE public.loop_requests
     SET status = 'matched', tutor_id = auth.uid(), accepted_at = now()
   WHERE id = _request_id
     AND status = 'open'
     AND expires_at > now()
  RETURNING * INTO result;

  IF result.id IS NULL THEN
    RAISE EXCEPTION 'This request is no longer available';
  END IF;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_loop_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_loop_request(uuid) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.loop_requests;