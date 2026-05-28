-- Phase 2: RBAC — user_roles table, admin function, RLS on words_dim
-- Run in Supabase SQL editor.

-- 1. Create user_roles table
CREATE TABLE public.user_roles (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('admin')),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Users can read their own role row (used by client-side useIsAdmin hook)
CREATE POLICY "users read own role" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- 2. Helper function (SECURITY DEFINER so it can read user_roles without policy recursion)
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS BOOLEAN
LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

-- 3. Enable RLS on words_dim and add policies
ALTER TABLE public.words_dim ENABLE ROW LEVEL SECURITY;

-- Everyone can read all words
CREATE POLICY "read all words" ON public.words_dim
  FOR SELECT USING (true);

-- Insert: user must be the owner or an admin
CREATE POLICY "insert own words" ON public.words_dim
  FOR INSERT WITH CHECK (auth.uid() = created_by_user_id OR public.is_admin());

-- Update: owner or admin
-- Note: global system words have created_by_user_id IS NULL — auth.uid() = NULL is always false,
-- so only admins can update them.
CREATE POLICY "owner or admin updates" ON public.words_dim
  FOR UPDATE USING (auth.uid() = created_by_user_id OR public.is_admin());

-- Delete: owner or admin
CREATE POLICY "owner or admin deletes" ON public.words_dim
  FOR DELETE USING (auth.uid() = created_by_user_id OR public.is_admin());

-- 4. Seed: grant admin to the project owner
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'baptiste.dufresne@gmail.com'
ON CONFLICT (user_id) DO NOTHING;
