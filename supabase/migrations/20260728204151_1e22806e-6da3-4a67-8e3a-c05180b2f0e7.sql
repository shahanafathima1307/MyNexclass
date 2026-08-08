-- 1. Tutor details
CREATE TABLE public.tutor_details (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  headline text,
  badge text,
  degree text,
  languages text,
  years_experience integer NOT NULL DEFAULT 0,
  hourly_rate numeric(10,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutor_details TO authenticated;
GRANT ALL ON public.tutor_details TO service_role;
ALTER TABLE public.tutor_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users can view tutor details" ON public.tutor_details
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Tutors manage own details" ON public.tutor_details
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER tutor_details_updated_at BEFORE UPDATE ON public.tutor_details
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Availability (free slots)
CREATE TABLE public.tutor_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  time_zone text NOT NULL DEFAULT 'UTC',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutor_availability TO authenticated;
GRANT ALL ON public.tutor_availability TO service_role;
ALTER TABLE public.tutor_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users can view availability" ON public.tutor_availability
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Tutors manage own availability" ON public.tutor_availability
  FOR ALL TO authenticated
  USING (tutor_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (tutor_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::public.app_role));

-- 3. Class feedback
CREATE TABLE public.class_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL UNIQUE REFERENCES public.classes(id) ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid(),
  topic_covered text,
  homework text,
  note_to_parent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_feedback TO authenticated;
GRANT ALL ON public.class_feedback TO service_role;
ALTER TABLE public.class_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants can view class feedback" ON public.class_feedback
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_feedback.class_id
      AND (c.tutor_id = auth.uid() OR c.student_id = auth.uid()))
    OR private.has_role(auth.uid(), 'admin'::public.app_role)
  );
CREATE POLICY "Tutor of the class writes feedback" ON public.class_feedback
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_feedback.class_id AND c.tutor_id = auth.uid())
    OR private.has_role(auth.uid(), 'admin'::public.app_role)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_feedback.class_id AND c.tutor_id = auth.uid())
    OR private.has_role(auth.uid(), 'admin'::public.app_role)
  );
CREATE TRIGGER class_feedback_updated_at BEFORE UPDATE ON public.class_feedback
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Loop requests
CREATE TYPE public.request_status AS ENUM ('pending', 'accepted', 'declined');
CREATE TABLE public.class_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject text,
  message text,
  preferred_time text,
  status public.request_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_requests TO authenticated;
GRANT ALL ON public.class_requests TO service_role;
ALTER TABLE public.class_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants can view requests" ON public.class_requests
  FOR SELECT TO authenticated USING (
    tutor_id = auth.uid() OR student_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::public.app_role)
  );
CREATE POLICY "Students create requests" ON public.class_requests
  FOR INSERT TO authenticated WITH CHECK (
    student_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::public.app_role)
  );
CREATE POLICY "Tutor or admin updates requests" ON public.class_requests
  FOR UPDATE TO authenticated
  USING (tutor_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (tutor_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Student or admin deletes requests" ON public.class_requests
  FOR DELETE TO authenticated
  USING (student_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER class_requests_updated_at BEFORE UPDATE ON public.class_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Tutor ratings
CREATE TABLE public.tutor_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tutor_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutor_ratings TO authenticated;
GRANT ALL ON public.tutor_ratings TO service_role;
ALTER TABLE public.tutor_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users can view ratings" ON public.tutor_ratings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Students manage own rating" ON public.tutor_ratings
  FOR ALL TO authenticated
  USING (student_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (student_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER tutor_ratings_updated_at BEFORE UPDATE ON public.tutor_ratings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();