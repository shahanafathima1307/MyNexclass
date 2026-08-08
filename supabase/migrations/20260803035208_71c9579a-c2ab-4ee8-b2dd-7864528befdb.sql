-- 1. Role + status enums
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';

DO $$ BEGIN
  CREATE TYPE public.approval_status AS ENUM (
    'draft','pending_approval','under_review','more_info_required',
    'approved','rejected','suspended','deactivated'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Role check that avoids new-enum-literal usage in this transaction
CREATE OR REPLACE FUNCTION public.is_approval_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id AND ur.role::text IN ('admin','super_admin')
  )
$$;
REVOKE ALL ON FUNCTION public.is_approval_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_approval_admin(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id AND ur.role::text = 'super_admin'
  )
$$;
REVOKE ALL ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, service_role;

-- 2. Approval requests
CREATE TABLE public.approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  user_type text NOT NULL DEFAULT 'student',
  status public.approval_status NOT NULL DEFAULT 'pending_approval',
  submitted_at timestamptz,
  assigned_reviewer uuid,
  review_started_at timestamptz,
  decision_at timestamptz,
  decision_by uuid,
  decision_reason text,
  internal_reason text,
  user_message text,
  requested_fields text[] NOT NULL DEFAULT '{}',
  request_instructions text,
  response_deadline timestamptz,
  applicant_response text,
  resubmitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.approval_requests TO authenticated;
GRANT ALL ON public.approval_requests TO service_role;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own request read" ON public.approval_requests
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_approval_admin(auth.uid()));
CREATE POLICY "admins update requests" ON public.approval_requests
  FOR UPDATE TO authenticated USING (public.is_approval_admin(auth.uid()))
  WITH CHECK (public.is_approval_admin(auth.uid()));
CREATE POLICY "admins insert requests" ON public.approval_requests
  FOR INSERT TO authenticated WITH CHECK (public.is_approval_admin(auth.uid()));

CREATE TRIGGER approval_requests_updated_at BEFORE UPDATE ON public.approval_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Registration details
CREATE TABLE public.registration_details (
  user_id uuid PRIMARY KEY,
  mobile text,
  whatsapp text,
  mobile_verified boolean NOT NULL DEFAULT false,
  country text,
  state text,
  time_zone text,
  referral_source text,
  terms_accepted_at timestamptz,
  notification_consent boolean NOT NULL DEFAULT true,
  -- student
  parent_name text,
  parent_contact text,
  grade text,
  school text,
  subjects_of_interest text,
  -- tutor
  subjects_taught text,
  grades_taught text,
  education text,
  work_experience text,
  teaching_experience text,
  certifications text,
  hourly_rate numeric,
  availability_notes text,
  short_bio text,
  intro_video_url text,
  background_check_status text NOT NULL DEFAULT 'not_started',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.registration_details TO authenticated;
GRANT ALL ON public.registration_details TO service_role;
ALTER TABLE public.registration_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own details read" ON public.registration_details
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_approval_admin(auth.uid()));
CREATE POLICY "own details write" ON public.registration_details
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR public.is_approval_admin(auth.uid()));
CREATE POLICY "own details update" ON public.registration_details
  FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.is_approval_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_approval_admin(auth.uid()));

CREATE TRIGGER registration_details_updated_at BEFORE UPDATE ON public.registration_details
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Documents (private storage) + access log
CREATE TABLE public.approval_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  file_size bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.approval_documents TO authenticated;
GRANT ALL ON public.approval_documents TO service_role;
ALTER TABLE public.approval_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own docs read" ON public.approval_documents
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_approval_admin(auth.uid()));
CREATE POLICY "own docs insert" ON public.approval_documents
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE TABLE public.document_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.approval_documents(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.document_access_log TO authenticated;
GRANT ALL ON public.document_access_log TO service_role;
ALTER TABLE public.document_access_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read access log" ON public.document_access_log
  FOR SELECT TO authenticated USING (public.is_approval_admin(auth.uid()));
CREATE POLICY "viewers log access" ON public.document_access_log
  FOR INSERT TO authenticated WITH CHECK (viewer_id = auth.uid());

-- 5. Append-only history
CREATE TABLE public.approval_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.approval_requests(id) ON DELETE CASCADE,
  actor_id uuid,
  actor_role text,
  action text NOT NULL,
  from_status public.approval_status,
  to_status public.approval_status,
  reason text,
  has_internal_note boolean NOT NULL DEFAULT false,
  requested_fields text[] NOT NULL DEFAULT '{}',
  document_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.approval_history TO authenticated;
GRANT ALL ON public.approval_history TO service_role;
ALTER TABLE public.approval_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "history read" ON public.approval_history
  FOR SELECT TO authenticated USING (
    public.is_approval_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.approval_requests r WHERE r.id = request_id AND r.user_id = auth.uid())
  );
CREATE POLICY "history insert" ON public.approval_history
  FOR INSERT TO authenticated WITH CHECK (
    actor_id = auth.uid() AND (
      public.is_approval_admin(auth.uid())
      OR EXISTS (SELECT 1 FROM public.approval_requests r WHERE r.id = request_id AND r.user_id = auth.uid())
    )
  );

-- 6. Internal notes (admins only)
CREATE TABLE public.approval_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.approval_requests(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.approval_notes TO authenticated;
GRANT ALL ON public.approval_notes TO service_role;
ALTER TABLE public.approval_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read notes" ON public.approval_notes
  FOR SELECT TO authenticated USING (public.is_approval_admin(auth.uid()));
CREATE POLICY "admins write notes" ON public.approval_notes
  FOR INSERT TO authenticated WITH CHECK (public.is_approval_admin(auth.uid()) AND author_id = auth.uid());

-- 7. Duplicate flags
CREATE TABLE public.duplicate_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.approval_requests(id) ON DELETE CASCADE,
  matched_user_id uuid,
  match_field text NOT NULL,
  match_value text,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.duplicate_flags TO authenticated;
GRANT ALL ON public.duplicate_flags TO service_role;
ALTER TABLE public.duplicate_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage duplicate flags" ON public.duplicate_flags
  FOR ALL TO authenticated USING (public.is_approval_admin(auth.uid()))
  WITH CHECK (public.is_approval_admin(auth.uid()));

-- 8. Settings singleton
CREATE TABLE public.approval_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  student_approval_required boolean NOT NULL DEFAULT true,
  tutor_approval_required boolean NOT NULL DEFAULT true,
  require_email_verification boolean NOT NULL DEFAULT true,
  require_mobile_verification boolean NOT NULL DEFAULT false,
  mandatory_student_fields text[] NOT NULL DEFAULT ARRAY['mobile','grade','parent_contact'],
  mandatory_tutor_fields text[] NOT NULL DEFAULT ARRAY['mobile','subjects_taught','education','hourly_rate'],
  required_tutor_documents text[] NOT NULL DEFAULT ARRAY['resume','identity'],
  reminder_after_hours integer NOT NULL DEFAULT 48,
  max_pending_days integer NOT NULL DEFAULT 14,
  default_rejection_message text NOT NULL DEFAULT 'Your registration was not approved. Contact support if you need clarification.',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.approval_settings TO authenticated;
GRANT ALL ON public.approval_settings TO service_role;
ALTER TABLE public.approval_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings read" ON public.approval_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins update settings" ON public.approval_settings
  FOR UPDATE TO authenticated USING (public.is_approval_admin(auth.uid()))
  WITH CHECK (public.is_approval_admin(auth.uid()));
INSERT INTO public.approval_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

CREATE TRIGGER approval_settings_updated_at BEFORE UPDATE ON public.approval_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 9. Status helper used by app gating
CREATE OR REPLACE FUNCTION public.my_approval_status()
RETURNS public.approval_status LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT status FROM public.approval_requests WHERE user_id = auth.uid()
$$;
REVOKE ALL ON FUNCTION public.my_approval_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_approval_status() TO authenticated, service_role;

-- 10. Auto-create a pending request for new signups + notify admins
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  v_type text;
  v_req uuid;
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;

  v_type := COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'student');
  IF v_type NOT IN ('student','tutor') THEN v_type := 'student'; END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_type::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.approval_requests (user_id, user_type, status, submitted_at)
  VALUES (NEW.id, v_type, 'pending_approval', now())
  ON CONFLICT (user_id) DO NOTHING
  RETURNING id INTO v_req;

  INSERT INTO public.registration_details (user_id)
  VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;

  IF v_req IS NOT NULL THEN
    INSERT INTO public.approval_history (request_id, actor_id, actor_role, action, to_status)
    VALUES (v_req, NEW.id, v_type, 'registration_submitted', 'pending_approval');

    INSERT INTO public.notifications (user_id, title, body, link, kind)
    SELECT ur.user_id,
           'New ' || v_type || ' registration',
           COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email) || ' is waiting for approval.',
           '/approvals',
           'approval'
    FROM public.user_roles ur
    WHERE ur.role::text IN ('admin','super_admin');
  END IF;

  RETURN NEW;
END; $function$;

-- 11. Grandfather existing accounts as approved
INSERT INTO public.approval_requests (user_id, user_type, status, submitted_at, decision_at)
SELECT p.id,
       COALESCE((SELECT ur.role::text FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role::text <> 'admin' LIMIT 1), 'student'),
       'approved', p.created_at, now()
FROM public.profiles p
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.registration_details (user_id)
SELECT p.id FROM public.profiles p ON CONFLICT (user_id) DO NOTHING;

CREATE INDEX idx_approval_requests_status ON public.approval_requests(status);
CREATE INDEX idx_approval_history_request ON public.approval_history(request_id);