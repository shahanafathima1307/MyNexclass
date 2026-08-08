
-- 1. New status enum -------------------------------------------------------
CREATE TYPE public.assignment_state AS ENUM (
  'draft','assigned','viewed','in_progress','submitted','submitted_late',
  'under_review','revision_requested','resubmitted','graded','completed',
  'cancelled','overdue'
);

ALTER TABLE public.assignments ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.assignments
  ALTER COLUMN status TYPE public.assignment_state
  USING (CASE status::text
    WHEN 'returned' THEN 'revision_requested'
    WHEN 'submitted' THEN 'submitted'
    WHEN 'graded' THEN 'graded'
    ELSE 'assigned' END)::public.assignment_state;
ALTER TABLE public.assignments ALTER COLUMN status SET DEFAULT 'assigned'::public.assignment_state;

-- 2. Extra assignment fields ----------------------------------------------
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS grade_level text,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS allow_resubmission boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS group_id uuid NOT NULL DEFAULT gen_random_uuid();

ALTER TABLE public.assignments
  ADD CONSTRAINT assignments_priority_check CHECK (priority IN ('low','normal','high','urgent'));

CREATE INDEX IF NOT EXISTS assignments_student_idx ON public.assignments(student_id);
CREATE INDEX IF NOT EXISTS assignments_tutor_idx ON public.assignments(tutor_id);

-- 3. Access helper ---------------------------------------------------------
CREATE OR REPLACE FUNCTION private.can_access_assignment(_assignment_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.id = _assignment_id
      AND (a.tutor_id = auth.uid() OR a.student_id = auth.uid()
           OR private.has_role(auth.uid(),'admin'))
  )
$$;

CREATE OR REPLACE FUNCTION private.is_assignment_tutor(_assignment_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.id = _assignment_id
      AND (a.tutor_id = auth.uid() OR private.has_role(auth.uid(),'admin'))
  )
$$;

-- 4. Attachments -----------------------------------------------------------
CREATE TABLE public.assignment_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL,
  kind text NOT NULL DEFAULT 'brief',
  title text,
  file_name text,
  file_size bigint,
  mime_type text,
  storage_path text,
  external_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assignment_attachments_kind_check CHECK (kind IN ('brief','returned'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignment_attachments TO authenticated;
GRANT ALL ON public.assignment_attachments TO service_role;
ALTER TABLE public.assignment_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attachments readable by participants" ON public.assignment_attachments
  FOR SELECT TO authenticated USING (private.can_access_assignment(assignment_id));
CREATE POLICY "tutors add attachments" ON public.assignment_attachments
  FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid() AND private.is_assignment_tutor(assignment_id));
CREATE POLICY "tutors remove attachments" ON public.assignment_attachments
  FOR DELETE TO authenticated USING (private.is_assignment_tutor(assignment_id));

-- 5. Submission versions ---------------------------------------------------
ALTER TABLE public.assignment_submissions
  DROP CONSTRAINT IF EXISTS assignment_submissions_assignment_id_student_id_key;
ALTER TABLE public.assignment_submissions
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_late boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS marks numeric;
ALTER TABLE public.assignment_submissions
  ADD CONSTRAINT assignment_submissions_version_key UNIQUE (assignment_id, student_id, version);

CREATE TABLE public.submission_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.assignment_submissions(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL,
  file_name text NOT NULL,
  file_size bigint,
  mime_type text,
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.submission_files TO authenticated;
GRANT ALL ON public.submission_files TO service_role;
ALTER TABLE public.submission_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "submission files readable by participants" ON public.submission_files
  FOR SELECT TO authenticated USING (private.can_access_assignment(assignment_id));
CREATE POLICY "students add submission files" ON public.submission_files
  FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid() AND private.can_access_assignment(assignment_id));

-- 6. Immutable history -----------------------------------------------------
CREATE TABLE public.assignment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL,
  actor_role text,
  action text NOT NULL,
  from_status text,
  to_status text,
  file_version integer,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.assignment_history TO authenticated;
GRANT ALL ON public.assignment_history TO service_role;
ALTER TABLE public.assignment_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "history readable by participants" ON public.assignment_history
  FOR SELECT TO authenticated USING (private.can_access_assignment(assignment_id));
CREATE POLICY "participants append history" ON public.assignment_history
  FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid() AND private.can_access_assignment(assignment_id));
CREATE INDEX assignment_history_assignment_idx ON public.assignment_history(assignment_id, created_at);

-- 7. Storage policies ------------------------------------------------------
DROP POLICY IF EXISTS "assignment files readable by participants" ON storage.objects;
CREATE POLICY "assignment files readable by participants" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'assignments'
    AND private.can_access_assignment(NULLIF((storage.foldername(name))[1], '')::uuid)
  );
DROP POLICY IF EXISTS "assignment files uploadable by participants" ON storage.objects;
CREATE POLICY "assignment files uploadable by participants" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'assignments'
    AND private.can_access_assignment(NULLIF((storage.foldername(name))[1], '')::uuid)
  );
