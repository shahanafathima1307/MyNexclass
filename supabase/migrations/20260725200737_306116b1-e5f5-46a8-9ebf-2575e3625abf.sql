CREATE TYPE public.app_role AS ENUM ('tutor', 'student');
CREATE TYPE public.class_status AS ENUM ('scheduled', 'completed', 'cancelled');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  bio text,
  subjects text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view roles" ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE TABLE public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  subject text,
  starts_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60,
  status public.class_status NOT NULL DEFAULT 'scheduled',
  meeting_url text,
  notes text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes TO authenticated;
GRANT ALL ON public.classes TO service_role;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants can view their classes" ON public.classes FOR SELECT TO authenticated USING (auth.uid() = tutor_id OR auth.uid() = student_id);
CREATE POLICY "Participants can create classes" ON public.classes FOR INSERT TO authenticated WITH CHECK (auth.uid() = tutor_id OR auth.uid() = student_id);
CREATE POLICY "Participants can update their classes" ON public.classes FOR UPDATE TO authenticated USING (auth.uid() = tutor_id OR auth.uid() = student_id) WITH CHECK (auth.uid() = tutor_id OR auth.uid() = student_id);
CREATE POLICY "Participants can delete their classes" ON public.classes FOR DELETE TO authenticated USING (auth.uid() = tutor_id OR auth.uid() = student_id);
CREATE INDEX classes_tutor_idx ON public.classes (tutor_id, starts_at);
CREATE INDEX classes_student_idx ON public.classes (student_id, starts_at);

CREATE TABLE public.recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL,
  storage_path text,
  external_url text,
  duration_label text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recordings TO authenticated;
GRANT ALL ON public.recordings TO service_role;
ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Class participants can view recordings" ON public.recordings FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_id AND (c.tutor_id = auth.uid() OR c.student_id = auth.uid()))
);
CREATE POLICY "Class participants can add recordings" ON public.recordings FOR INSERT TO authenticated WITH CHECK (
  uploaded_by = auth.uid() AND EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_id AND (c.tutor_id = auth.uid() OR c.student_id = auth.uid()))
);
CREATE POLICY "Uploaders can delete recordings" ON public.recordings FOR DELETE TO authenticated USING (uploaded_by = auth.uid());

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER classes_updated_at BEFORE UPDATE ON public.classes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'student')::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();