CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_type text;
  v_req uuid;
  v_verified boolean;
  v_status public.approval_status;
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;

  v_type := COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'student');
  IF v_type NOT IN ('student','tutor') THEN v_type := 'student'; END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_type::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  v_verified := NEW.email_confirmed_at IS NOT NULL;
  v_status := CASE WHEN v_verified THEN 'pending_approval'::public.approval_status
                   ELSE 'draft'::public.approval_status END;

  INSERT INTO public.approval_requests (user_id, user_type, status, submitted_at)
  VALUES (NEW.id, v_type, v_status, CASE WHEN v_verified THEN now() ELSE NULL END)
  ON CONFLICT (user_id) DO NOTHING
  RETURNING id INTO v_req;

  INSERT INTO public.registration_details (user_id)
  VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;

  IF v_req IS NOT NULL THEN
    INSERT INTO public.approval_history (request_id, actor_id, actor_role, action, to_status)
    VALUES (v_req, NEW.id, v_type,
            CASE WHEN v_verified THEN 'registration_submitted' ELSE 'registration_started' END,
            v_status);

    IF v_verified THEN
      INSERT INTO public.notifications (user_id, title, body, link, kind)
      SELECT ur.user_id,
             'New ' || v_type || ' registration',
             COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email) || ' is waiting for approval.',
             '/approvals',
             'approval'
      FROM public.user_roles ur
      WHERE ur.role::text IN ('admin','super_admin');
    END IF;
  END IF;

  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.activate_pending_approval()
 RETURNS public.approval_status
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_verified boolean;
  v_req public.approval_requests;
  v_name text;
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;

  SELECT (u.email_confirmed_at IS NOT NULL) INTO v_verified FROM auth.users u WHERE u.id = v_uid;

  SELECT * INTO v_req FROM public.approval_requests WHERE user_id = v_uid;
  IF v_req.id IS NULL THEN RETURN NULL; END IF;
  IF NOT COALESCE(v_verified, false) OR v_req.status <> 'draft' THEN RETURN v_req.status; END IF;

  UPDATE public.approval_requests
     SET status = 'pending_approval', submitted_at = now(), updated_at = now()
   WHERE id = v_req.id;

  INSERT INTO public.approval_history (request_id, actor_id, actor_role, action, from_status, to_status)
  VALUES (v_req.id, v_uid, v_req.user_type, 'email_verified', 'draft', 'pending_approval');

  SELECT full_name INTO v_name FROM public.profiles WHERE id = v_uid;

  INSERT INTO public.notifications (user_id, title, body, link, kind)
  SELECT ur.user_id,
         'New ' || v_req.user_type || ' registration',
         COALESCE(v_name, 'A new member') || ' verified their email and is waiting for approval.',
         '/approvals',
         'approval'
  FROM public.user_roles ur
  WHERE ur.role::text IN ('admin','super_admin');

  RETURN 'pending_approval'::public.approval_status;
END; $function$;

REVOKE ALL ON FUNCTION public.activate_pending_approval() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activate_pending_approval() TO authenticated, service_role;