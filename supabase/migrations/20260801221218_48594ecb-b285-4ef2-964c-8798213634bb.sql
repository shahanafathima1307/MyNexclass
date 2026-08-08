CREATE TYPE public.assignment_status AS ENUM ('assigned','submitted','graded','returned');

CREATE TABLE public.assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL,
  student_id uuid NOT NULL,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  title text NOT NULL,
  instructions text,
  subject text,
  due_at timestamptz,
  status public.assignment_status NOT NULL DEFAULT 'assigned',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignments TO authenticated;
GRANT ALL ON public.assignments TO service_role;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants view assignments" ON public.assignments FOR SELECT TO authenticated
  USING (auth.uid() = tutor_id OR auth.uid() = student_id OR private.has_role(auth.uid(),'admin'));
CREATE POLICY "Tutors create assignments" ON public.assignments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = tutor_id OR private.has_role(auth.uid(),'admin'));
CREATE POLICY "Tutors update assignments" ON public.assignments FOR UPDATE TO authenticated
  USING (auth.uid() = tutor_id OR private.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = tutor_id OR private.has_role(auth.uid(),'admin'));
CREATE POLICY "Students advance own assignment status" ON public.assignments FOR UPDATE TO authenticated
  USING (auth.uid() = student_id) WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Tutors delete assignments" ON public.assignments FOR DELETE TO authenticated
  USING (auth.uid() = tutor_id OR private.has_role(auth.uid(),'admin'));

CREATE TRIGGER assignments_set_updated_at BEFORE UPDATE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.assignment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  content text,
  storage_path text,
  external_url text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  grade text,
  feedback text,
  graded_at timestamptz,
  graded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, student_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignment_submissions TO authenticated;
GRANT ALL ON public.assignment_submissions TO service_role;
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants view submissions" ON public.assignment_submissions FOR SELECT TO authenticated
  USING (
    auth.uid() = student_id
    OR private.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_id AND a.tutor_id = auth.uid())
  );
CREATE POLICY "Students submit own work" ON public.assignment_submissions FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = student_id
    AND EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_id AND a.student_id = auth.uid())
  );
CREATE POLICY "Students update own submission" ON public.assignment_submissions FOR UPDATE TO authenticated
  USING (auth.uid() = student_id) WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Tutors grade submissions" ON public.assignment_submissions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_id AND (a.tutor_id = auth.uid() OR private.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_id AND (a.tutor_id = auth.uid() OR private.has_role(auth.uid(),'admin'))));

CREATE TRIGGER assignment_submissions_set_updated_at BEFORE UPDATE ON public.assignment_submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();