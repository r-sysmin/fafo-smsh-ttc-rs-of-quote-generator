-- 1. Restrict SECURITY DEFINER function execution
REVOKE EXECUTE ON FUNCTION public.get_user_org_id(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.hash_share_password(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.verify_share_password(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_role_changes() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_user_org_id(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.hash_share_password(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.verify_share_password(text, text) TO service_role;

-- 2. proposal_versions policy no longer evaluated for anonymous role
DROP POLICY IF EXISTS "Managers and admins can view org proposal versions" ON public.proposal_versions;
CREATE POLICY "Managers and admins can view org proposal versions"
ON public.proposal_versions FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.proposals
  WHERE proposals.id = proposal_versions.proposal_id
    AND proposals.org_id = public.get_user_org_id(auth.uid())
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
));

DROP POLICY IF EXISTS "Users can manage versions of their proposals" ON public.proposal_versions;
CREATE POLICY "Users can manage versions of their proposals"
ON public.proposal_versions FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.proposals
  WHERE proposals.id = proposal_versions.proposal_id AND proposals.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.proposals
  WHERE proposals.id = proposal_versions.proposal_id AND proposals.user_id = auth.uid()
));

-- 3. proposal_events insert must exclude password-protected proposals
DROP POLICY IF EXISTS "Anyone can insert events for shared proposals" ON public.proposal_events;
CREATE POLICY "Anyone can insert events for shared proposals"
ON public.proposal_events FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.proposals
  WHERE proposals.id = proposal_events.proposal_id
    AND proposals.share_id IS NOT NULL
    AND proposals.status <> 'draft'::proposal_status
    AND proposals.share_password_hash IS NULL
    AND (proposals.share_expires_at IS NULL OR proposals.share_expires_at > now())
));

-- 4. audit_logs: writes only via service role
REVOKE INSERT, UPDATE, DELETE ON public.audit_logs FROM anon, authenticated;
REVOKE SELECT ON public.audit_logs FROM anon;
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

CREATE POLICY "No client writes to audit logs"
ON public.audit_logs AS RESTRICTIVE FOR ALL TO anon, authenticated
USING (true) WITH CHECK (false);