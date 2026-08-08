-- SETTINGS
CREATE TABLE public.referral_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  is_active boolean NOT NULL DEFAULT true,
  milestone text NOT NULL DEFAULT 'first_class',
  referrer_reward numeric NOT NULL DEFAULT 10,
  referee_reward numeric NOT NULL DEFAULT 5,
  currency text NOT NULL DEFAULT 'USD',
  max_rewards_per_user integer NOT NULL DEFAULT 20,
  terms text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.referral_settings TO authenticated;
GRANT ALL ON public.referral_settings TO service_role;
ALTER TABLE public.referral_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings readable" ON public.referral_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage settings" ON public.referral_settings FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
GRANT INSERT, UPDATE, DELETE ON public.referral_settings TO authenticated;
CREATE TRIGGER referral_settings_updated BEFORE UPDATE ON public.referral_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.referral_settings (id) VALUES (true);

-- CODES
CREATE TABLE public.referral_codes (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.referral_codes TO authenticated;
GRANT ALL ON public.referral_codes TO service_role;
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own code select" ON public.referral_codes FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(),'admin'));
CREATE POLICY "own code insert" ON public.referral_codes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE TRIGGER referral_codes_updated BEFORE UPDATE ON public.referral_codes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- REFERRALS
CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  qualified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT no_self_referral CHECK (referrer_id <> referred_id)
);
CREATE INDEX referrals_referrer_idx ON public.referrals(referrer_id);
GRANT SELECT, INSERT, UPDATE ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "referral parties select" ON public.referrals FOR SELECT TO authenticated
  USING (referrer_id = auth.uid() OR referred_id = auth.uid() OR private.has_role(auth.uid(),'admin'));
CREATE POLICY "referred inserts own" ON public.referrals FOR INSERT TO authenticated
  WITH CHECK (referred_id = auth.uid() AND referrer_id <> auth.uid());
CREATE POLICY "admins update referrals" ON public.referrals FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE TRIGGER referrals_updated BEFORE UPDATE ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- REWARDS
CREATE TABLE public.referral_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_id uuid REFERENCES public.referrals(id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'earned',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX referral_rewards_user_idx ON public.referral_rewards(user_id);
GRANT SELECT ON public.referral_rewards TO authenticated;
GRANT INSERT, UPDATE ON public.referral_rewards TO authenticated;
GRANT ALL ON public.referral_rewards TO service_role;
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own rewards select" ON public.referral_rewards FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(),'admin'));
CREATE POLICY "admins manage rewards" ON public.referral_rewards FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE TRIGGER referral_rewards_updated BEFORE UPDATE ON public.referral_rewards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Code lookup without exposing other users' rows
CREATE OR REPLACE FUNCTION public.resolve_referral_code(_code text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id FROM public.referral_codes WHERE upper(code) = upper(_code) LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.resolve_referral_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_referral_code(text) TO authenticated;

-- Fraud guard: qualification/rewards only ever set by admin policies above;
-- enforce status vocabulary
CREATE OR REPLACE FUNCTION public.validate_referral_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status NOT IN ('pending','qualified','rewarded','rejected') THEN
    RAISE EXCEPTION 'Invalid referral status %', NEW.status;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER referrals_status_check BEFORE INSERT OR UPDATE ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.validate_referral_status();