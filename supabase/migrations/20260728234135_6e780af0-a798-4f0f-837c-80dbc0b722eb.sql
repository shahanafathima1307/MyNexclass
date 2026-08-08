-- Group classes
CREATE TABLE public.class_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  added_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.class_participants TO authenticated;
GRANT ALL ON public.class_participants TO service_role;
ALTER TABLE public.class_participants ENABLE ROW LEVEL SECURITY;

-- Membership helpers (private schema, not callable from the API)
CREATE OR REPLACE FUNCTION private.is_class_member(_user_id uuid, _class_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id = _class_id AND (c.tutor_id = _user_id OR c.student_id = _user_id)
  ) OR EXISTS (
    SELECT 1 FROM public.class_participants p
    WHERE p.class_id = _class_id AND p.user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION private.is_class_host(_user_id uuid, _class_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classes c WHERE c.id = _class_id AND c.tutor_id = _user_id
  ) OR private.has_role(_user_id, 'admin'::public.app_role)
$$;

CREATE POLICY "Class members can view participants"
  ON public.class_participants FOR SELECT TO authenticated
  USING (private.is_class_member(auth.uid(), class_id) OR private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Tutor or admin can add participants"
  ON public.class_participants FOR INSERT TO authenticated
  WITH CHECK (private.is_class_host(auth.uid(), class_id));

CREATE POLICY "Tutor or admin can remove participants"
  ON public.class_participants FOR DELETE TO authenticated
  USING (private.is_class_host(auth.uid(), class_id));

-- Extra participants can see the class itself
CREATE POLICY "Extra participants can view their classes"
  ON public.classes FOR SELECT TO authenticated
  USING (private.is_class_member(auth.uid(), id));

-- Attendance
CREATE TABLE public.class_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz
);

CREATE INDEX class_attendance_class_idx ON public.class_attendance(class_id);
CREATE INDEX class_participants_class_idx ON public.class_participants(class_id);

GRANT SELECT, INSERT, UPDATE ON public.class_attendance TO authenticated;
GRANT ALL ON public.class_attendance TO service_role;
ALTER TABLE public.class_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Class members can view attendance"
  ON public.class_attendance FOR SELECT TO authenticated
  USING (private.is_class_member(auth.uid(), class_id) OR private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Members record their own attendance"
  ON public.class_attendance FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND private.is_class_member(auth.uid(), class_id));

CREATE POLICY "Members close their own attendance"
  ON public.class_attendance FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());