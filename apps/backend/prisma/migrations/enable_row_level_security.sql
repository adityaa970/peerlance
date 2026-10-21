-- Turn on Row Level Security for every table in the public schema.
--
-- Why: the mobile app ships with the Supabase anon key (EXPO_PUBLIC_SUPABASE_ANON_KEY),
-- so anyone can extract it. Without RLS that key can read and write every table:
-- user emails, wallet balances, ID verifications, chats, transactions.
--
-- Safe for the backend: every API route uses SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS.
-- Prisma connects as the table owner, which also bypasses RLS.
--
-- Run in: Supabase dashboard -> SQL Editor. To undo for one table:
--   ALTER TABLE public."<table>" DISABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;

-- The app's update checker (mobile/services/updateService.ts) reads app_versions
-- directly with the anon key, so keep active versions readable.
DROP POLICY IF EXISTS "Anyone can read active app versions" ON public.app_versions;
CREATE POLICY "Anyone can read active app versions"
  ON public.app_versions
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);
