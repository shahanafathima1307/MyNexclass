CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION private.shares_class_with(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classes c
    WHERE (c.tutor_id = _a AND c.student_id = _b)
       OR (c.tutor_id = _b AND c.student_id = _a)
  );
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.shares_class_with(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.shares_class_with(uuid, uuid) TO authenticated, service_role;

-- Repoint app policies
DROP POLICY "Admins can insert roles" ON public.user_roles;
DROP POLICY "Admins can update roles" ON public.user_roles;
DROP POLICY "Admins can delete roles" ON public.user_roles;
DROP POLICY "Users can view their own roles" ON public.user_roles;
DROP POLICY "Admins can update any profile" ON public.profiles;
DROP POLICY "Admins can view all classes" ON public.classes;
DROP POLICY "Admins can update all classes" ON public.classes;
DROP POLICY "Admins can delete all classes" ON public.classes;
DROP POLICY "Contacts visible to owner, admins and class partners" ON public.profile_contacts;
DROP POLICY "Owner or admin can insert contacts" ON public.profile_contacts;
DROP POLICY "Owner or admin can update contacts" ON public.profile_contacts;
DROP POLICY "Owner or admin can delete contacts" ON public.profile_contacts;

CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated
  USING ((user_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Directory roles visible to signed-in users" ON public.user_roles FOR SELECT TO authenticated
  USING (role <> 'admin');

CREATE POLICY "Admins can update any profile" ON public.profiles FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all classes" ON public.classes FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update all classes" ON public.classes FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete all classes" ON public.classes FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Contacts visible to owner, admins and class partners" ON public.profile_contacts FOR SELECT TO authenticated
  USING ((user_id = auth.uid()) OR private.has_role(auth.uid(), 'admin') OR private.shares_class_with(auth.uid(), user_id));
CREATE POLICY "Owner or admin can insert contacts" ON public.profile_contacts FOR INSERT TO authenticated
  WITH CHECK ((user_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owner or admin can update contacts" ON public.profile_contacts FOR UPDATE TO authenticated
  USING ((user_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'))
  WITH CHECK ((user_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owner or admin can delete contacts" ON public.profile_contacts FOR DELETE TO authenticated
  USING ((user_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'));

-- Repoint avatar storage policies
DROP POLICY "Members upload their own avatar" ON storage.objects;
DROP POLICY "Members update their own avatar" ON storage.objects;
DROP POLICY "Members delete their own avatar" ON storage.objects;

CREATE POLICY "Members upload their own avatar" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND ((storage.foldername(name))[1] = auth.uid()::text OR private.has_role(auth.uid(), 'admin')));
CREATE POLICY "Members update their own avatar" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND ((storage.foldername(name))[1] = auth.uid()::text OR private.has_role(auth.uid(), 'admin')));
CREATE POLICY "Members delete their own avatar" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND ((storage.foldername(name))[1] = auth.uid()::text OR private.has_role(auth.uid(), 'admin')));

-- Directory lookup no longer runs with elevated privileges
CREATE OR REPLACE FUNCTION public.directory_roles()
RETURNS TABLE(user_id uuid, role public.app_role)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT ur.user_id, ur.role FROM public.user_roles ur WHERE ur.role <> 'admin'
$$;

DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.shares_class_with(uuid, uuid);

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
