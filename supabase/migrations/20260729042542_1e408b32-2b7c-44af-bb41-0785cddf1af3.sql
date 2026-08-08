-- ENUMS
CREATE TYPE public.plan_interval AS ENUM ('one_time','monthly','yearly');
CREATE TYPE public.payment_status AS ENUM ('pending','paid','failed','refunded');
CREATE TYPE public.subscription_status AS ENUM ('active','cancelled','past_due');
CREATE TYPE public.payout_status AS ENUM ('requested','approved','paid','rejected');

-- PLANS
CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  interval public.plan_interval NOT NULL DEFAULT 'monthly',
  classes_included integer NOT NULL DEFAULT 0,
  features text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active plans" ON public.plans FOR SELECT TO anon, authenticated USING (is_active OR private.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage plans" ON public.plans FOR ALL TO authenticated USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE TRIGGER plans_updated_at BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- SUBSCRIPTIONS
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE RESTRICT,
  status public.subscription_status NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner or admin views subscriptions" ON public.subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid() OR private.has_role(auth.uid(),'admin'));
CREATE POLICY "Owner or admin creates subscriptions" ON public.subscriptions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR private.has_role(auth.uid(),'admin'));
CREATE POLICY "Owner or admin updates subscriptions" ON public.subscriptions FOR UPDATE TO authenticated USING (user_id = auth.uid() OR private.has_role(auth.uid(),'admin')) WITH CHECK (user_id = auth.uid() OR private.has_role(auth.uid(),'admin'));
CREATE POLICY "Owner or admin deletes subscriptions" ON public.subscriptions FOR DELETE TO authenticated USING (user_id = auth.uid() OR private.has_role(auth.uid(),'admin'));
CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- PAYMENTS
CREATE SEQUENCE public.invoice_seq START 1001;
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  status public.payment_status NOT NULL DEFAULT 'pending',
  description text,
  invoice_number text NOT NULL UNIQUE DEFAULT ('INV-' || nextval('public.invoice_seq')::text),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT USAGE ON SEQUENCE public.invoice_seq TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner or admin views payments" ON public.payments FOR SELECT TO authenticated USING (user_id = auth.uid() OR private.has_role(auth.uid(),'admin'));
CREATE POLICY "Owner or admin creates payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR private.has_role(auth.uid(),'admin'));
CREATE POLICY "Owner or admin updates payments" ON public.payments FOR UPDATE TO authenticated USING (user_id = auth.uid() OR private.has_role(auth.uid(),'admin')) WITH CHECK (user_id = auth.uid() OR private.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete payments" ON public.payments FOR DELETE TO authenticated USING (private.has_role(auth.uid(),'admin'));
CREATE TRIGGER payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- PAYOUT ACCOUNTS
CREATE TABLE public.payout_accounts (
  user_id uuid PRIMARY KEY,
  method text NOT NULL DEFAULT 'bank',
  account_name text,
  account_number text,
  ifsc text,
  upi_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payout_accounts TO authenticated;
GRANT ALL ON public.payout_accounts TO service_role;
ALTER TABLE public.payout_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner or admin manages payout accounts" ON public.payout_accounts FOR ALL TO authenticated USING (user_id = auth.uid() OR private.has_role(auth.uid(),'admin')) WITH CHECK (user_id = auth.uid() OR private.has_role(auth.uid(),'admin'));
CREATE TRIGGER payout_accounts_updated_at BEFORE UPDATE ON public.payout_accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- PAYOUT REQUESTS
CREATE TABLE public.payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL DEFAULT auth.uid(),
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  status public.payout_status NOT NULL DEFAULT 'requested',
  note text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payout_requests TO authenticated;
GRANT ALL ON public.payout_requests TO service_role;
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tutor or admin views payouts" ON public.payout_requests FOR SELECT TO authenticated USING (tutor_id = auth.uid() OR private.has_role(auth.uid(),'admin'));
CREATE POLICY "Tutor creates payouts" ON public.payout_requests FOR INSERT TO authenticated WITH CHECK (tutor_id = auth.uid() OR private.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin updates payouts" ON public.payout_requests FOR UPDATE TO authenticated USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE POLICY "Tutor or admin deletes pending payouts" ON public.payout_requests FOR DELETE TO authenticated USING ((tutor_id = auth.uid() AND status = 'requested') OR private.has_role(auth.uid(),'admin'));
CREATE TRIGGER payout_requests_updated_at BEFORE UPDATE ON public.payout_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- MESSAGES
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL DEFAULT auth.uid(),
  recipient_id uuid NOT NULL,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_pair_idx ON public.messages (sender_id, recipient_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants view messages" ON public.messages FOR SELECT TO authenticated USING (sender_id = auth.uid() OR recipient_id = auth.uid() OR private.has_role(auth.uid(),'admin'));
CREATE POLICY "Sender sends messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());
CREATE POLICY "Recipient marks read" ON public.messages FOR UPDATE TO authenticated USING (recipient_id = auth.uid()) WITH CHECK (recipient_id = auth.uid());
CREATE POLICY "Sender or admin deletes messages" ON public.messages FOR DELETE TO authenticated USING (sender_id = auth.uid() OR private.has_role(auth.uid(),'admin'));

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  kind text NOT NULL DEFAULT 'info',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON public.notifications (user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner views notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid() OR private.has_role(auth.uid(),'admin'));
CREATE POLICY "Signed-in users create notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Owner updates notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owner deletes notifications" ON public.notifications FOR DELETE TO authenticated USING (user_id = auth.uid() OR private.has_role(auth.uid(),'admin'));

-- AUDIT LOG
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL DEFAULT auth.uid(),
  action text NOT NULL,
  entity text,
  entity_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_created_idx ON public.audit_log (created_at DESC);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read audit log" ON public.audit_log FOR SELECT TO authenticated USING (private.has_role(auth.uid(),'admin'));
CREATE POLICY "Signed-in users write audit log" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());

-- CLASS MATERIALS
CREATE TABLE public.class_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL,
  notes text,
  storage_path text,
  external_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_materials TO authenticated;
GRANT ALL ON public.class_materials TO service_role;
ALTER TABLE public.class_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Class members view materials" ON public.class_materials FOR SELECT TO authenticated USING (private.is_class_member(auth.uid(), class_id) OR private.has_role(auth.uid(),'admin'));
CREATE POLICY "Class host manages materials" ON public.class_materials FOR ALL TO authenticated USING (private.is_class_host(auth.uid(), class_id)) WITH CHECK (private.is_class_host(auth.uid(), class_id));
CREATE TRIGGER class_materials_updated_at BEFORE UPDATE ON public.class_materials FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- SEED PLANS
INSERT INTO public.plans (name, description, price, currency, interval, classes_included, features, sort_order) VALUES
  ('Trial', 'One free demo class to see if we are a good fit.', 0, 'USD', 'one_time', 1, ARRAY['1 demo class','Meet any tutor','No card needed'], 1),
  ('Starter', 'Four one-to-one classes each month.', 49, 'USD', 'monthly', 4, ARRAY['4 classes a month','Class recordings','Lesson notes'], 2),
  ('Regular', 'Eight classes a month for steady progress.', 89, 'USD', 'monthly', 8, ARRAY['8 classes a month','Class recordings','Lesson notes','Priority booking'], 3),
  ('Intensive', 'Sixteen classes a month with exam support.', 159, 'USD', 'monthly', 16, ARRAY['16 classes a month','Class recordings','Lesson notes','Priority booking','Exam prep sessions'], 4);