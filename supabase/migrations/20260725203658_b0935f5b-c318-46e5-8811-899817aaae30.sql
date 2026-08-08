ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS time_zone text NOT NULL DEFAULT 'UTC';