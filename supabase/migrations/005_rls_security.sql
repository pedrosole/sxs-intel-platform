-- ══════════════════════════════════════
-- 005: Security hardening — RLS fixes
-- ══════════════════════════════════════

-- 1. Enable RLS on agent_skill_learnings (was missing)
ALTER TABLE public.agent_skill_learnings ENABLE ROW LEVEL SECURITY;

-- 2. Add service role policy for agent_skill_learnings
CREATE POLICY "service_all" ON public.agent_skill_learnings
  FOR ALL USING (true) WITH CHECK (true);

-- NOTE: All tables currently use permissive `using (true)` policies.
-- This is acceptable because:
--   a) All access goes through server-side API routes (no client-side Supabase)
--   b) API routes are protected by API key middleware
--   c) The service role key bypasses RLS anyway
--
-- When multi-tenant auth is added (e.g. Supabase Auth), these policies
-- should be replaced with user-scoped policies like:
--   using (auth.uid() = user_id)
