BEGIN;

-- Return an explicit rowset so PostgREST has a deterministic consumption contract.
CREATE FUNCTION public.consume_tiktok_direct_post_state_v2(
  p_state_hash text,
  p_redirect_uri_hash text,
  p_environment text,
  p_app_id text
)
RETURNS TABLE(user_id uuid, connection_id uuid, token_version bigint)
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_environment IS DISTINCT FROM 'sandbox'
     OR p_app_id IS NULL OR p_app_id !~ '^[0-9a-f]{64}$'
     OR p_state_hash IS NULL OR p_state_hash !~ '^[0-9a-f]{64}$'
     OR p_redirect_uri_hash IS NULL OR p_redirect_uri_hash !~ '^[0-9a-f]{64}$' THEN
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE public.tiktok_oauth_states AS state
     SET consumed_at = pg_catalog.clock_timestamp()
   WHERE state.state_hash = p_state_hash
     AND state.redirect_uri_hash = p_redirect_uri_hash
     AND state.environment = p_environment
     AND state.app_id = p_app_id
     AND state.provider = 'tiktok'
     AND state.flow = 'tiktok_direct_post_upgrade'
     AND state.consumed_at IS NULL
     AND state.expires_at > pg_catalog.clock_timestamp()
  RETURNING state.user_id, state.upgrade_connection_id, state.upgrade_token_version;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_tiktok_direct_post_state_v2(text,text,text,text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.consume_tiktok_direct_post_state_v2(text,text,text,text)
  TO service_role;

COMMIT;
