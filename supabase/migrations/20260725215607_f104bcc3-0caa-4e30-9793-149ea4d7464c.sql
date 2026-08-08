CREATE TABLE IF NOT EXISTS public.profile_contacts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_email text,
  phone text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_contacts TO authenticated;
GRANT ALL ON public.profile_contacts TO service_role;

ALTER TABLE public.profile_contacts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.shares_class_with(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classes c
    WHERE (c.tutor_id = _a AND c.student_id = _b)
       OR (c.tutor_id = _b AND c.student_id = _a)
  );
$$;

CREATE POLICY "Contacts visible to owner, admins and class partners"
ON public.profile_contacts FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.shares_class_with(auth.uid(), user_id)
);

CREATE POLICY "Owner or admin can insert contacts"
ON public.profile_contacts FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owner or admin can update contacts"
ON public.profile_contacts FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owner or admin can delete contacts"
ON public.profile_contacts FOR DELETE TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

INSERT INTO public.profile_contacts (user_id, contact_email, phone)
SELECT id, contact_email, phone FROM public.profiles
WHERE contact_email IS NOT NULL OR phone IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS contact_email;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS phone;

DROP POLICY IF EXISTS "Authenticated users can view roles" ON public.user_roles;

CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.directory_roles()
RETURNS TABLE (user_id uuid, role app_role)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ur.user_id, ur.role
  FROM public.user_roles ur
  WHERE ur.role <> 'admin'
$$;

REVOKE ALL ON FUNCTION public.directory_roles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.directory_roles() TO authenticated;