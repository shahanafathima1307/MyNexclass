-- Calendar event types
CREATE TYPE public.calendar_event_kind AS ENUM ('personal', 'blocked', 'holiday');

CREATE TABLE public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  kind public.calendar_event_kind NOT NULL DEFAULT 'personal',
  title text NOT NULL,
  description text,
  location text,
  meeting_url text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  all_day boolean NOT NULL DEFAULT false,
  time_zone text NOT NULL DEFAULT 'UTC',
  is_global boolean NOT NULL DEFAULT false,
  color text,
  repeat_freq text NOT NULL DEFAULT 'none',
  repeat_interval integer NOT NULL DEFAULT 1,
  repeat_byweekday smallint[] NOT NULL DEFAULT '{}',
  repeat_until timestamptz,
  repeat_count integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_events TO authenticated;
GRANT ALL ON public.calendar_events TO service_role;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read own calendar events"
  ON public.calendar_events FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR (is_global AND kind = 'holiday'));

CREATE POLICY "Owners create calendar events"
  ON public.calendar_events FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND (NOT is_global OR private.has_role(auth.uid(), 'admin'))
    AND (kind <> 'holiday' OR private.has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Owners update calendar events"
  ON public.calendar_events FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR (is_global AND private.has_role(auth.uid(), 'admin')))
  WITH CHECK (owner_id = auth.uid() OR (is_global AND private.has_role(auth.uid(), 'admin')));

CREATE POLICY "Owners delete calendar events"
  ON public.calendar_events FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR (is_global AND private.has_role(auth.uid(), 'admin')));

CREATE TRIGGER calendar_events_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Reminders
CREATE TABLE public.event_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source text NOT NULL,
  source_id uuid NOT NULL,
  minutes_before integer NOT NULL DEFAULT 10,
  channel text NOT NULL DEFAULT 'in_app',
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, source, source_id, minutes_before, channel)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_reminders TO authenticated;
GRANT ALL ON public.event_reminders TO service_role;
ALTER TABLE public.event_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own reminders" ON public.event_reminders FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER event_reminders_updated_at
  BEFORE UPDATE ON public.event_reminders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- History
CREATE TABLE public.event_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  source_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  actor_role text,
  action text NOT NULL,
  field text,
  previous_value text,
  new_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.event_history TO authenticated;
GRANT ALL ON public.event_history TO service_role;
ALTER TABLE public.event_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read event history"
  ON public.event_history FOR SELECT TO authenticated
  USING (
    actor_id = auth.uid()
    OR private.has_role(auth.uid(), 'admin')
    OR (source = 'class' AND private.is_class_member(auth.uid(), source_id))
    OR (source = 'assignment' AND private.can_access_assignment(source_id))
  );

CREATE POLICY "Write event history"
  ON public.event_history FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

CREATE INDEX event_history_source_idx ON public.event_history (source, source_id, created_at DESC);

-- Preferences
CREATE TABLE public.calendar_preferences (
  user_id uuid PRIMARY KEY,
  view text NOT NULL DEFAULT 'week',
  time_zone text,
  hidden_calendars text[] NOT NULL DEFAULT '{}',
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_preferences TO authenticated;
GRANT ALL ON public.calendar_preferences TO service_role;
ALTER TABLE public.calendar_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own calendar preferences" ON public.calendar_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER calendar_preferences_updated_at
  BEFORE UPDATE ON public.calendar_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();