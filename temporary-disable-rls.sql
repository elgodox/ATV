-- TEMPORARY FIX: Disable RLS for testing
-- Execute this ONLY for testing purposes to see if favorites work without RLS
-- WARNING: This removes security - only use for debugging!

-- Disable RLS temporarily
ALTER TABLE public.favorites DISABLE ROW LEVEL SECURITY;

-- Test if favorites work now (you should be able to add/remove favorites)
-- After confirming it works, run the main supabase-rls-fix.sql script

-- To re-enable RLS after testing:
-- ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
