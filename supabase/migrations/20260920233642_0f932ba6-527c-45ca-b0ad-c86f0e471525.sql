CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  ) AND (auth.uid() IS NULL OR _user_id = auth.uid())
$function$;

CREATE OR REPLACE FUNCTION public.get_user_org_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT org_id FROM public.profiles
  WHERE user_id = _user_id
    AND (auth.uid() IS NULL OR _user_id = auth.uid())
  LIMIT 1
$function$;

REVOKE EXECUTE ON FUNCTION public.hash_share_password(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hash_share_password(text) TO service_role;