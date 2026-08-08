CREATE OR REPLACE FUNCTION public.notify_approval_admins(_title text, _body text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  INSERT INTO public.notifications (user_id, title, body, link, kind)
  SELECT DISTINCT ur.user_id, left(_title, 160), left(_body, 500), '/approvals', 'approval'
  FROM public.user_roles ur
  WHERE ur.role::text IN ('admin','super_admin');
END; $$;
REVOKE ALL ON FUNCTION public.notify_approval_admins(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notify_approval_admins(text, text) TO authenticated, service_role;