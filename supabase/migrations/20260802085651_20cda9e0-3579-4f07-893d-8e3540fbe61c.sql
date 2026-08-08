CREATE OR REPLACE FUNCTION public.directory_roles()
 RETURNS TABLE(user_id uuid, role app_role)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT ur.user_id, ur.role
  FROM public.user_roles ur
  WHERE ur.role <> 'admin' AND auth.uid() IS NOT NULL
$function$;

REVOKE ALL ON FUNCTION public.directory_roles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.directory_roles() TO authenticated;