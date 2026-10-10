-- Account-scoped internal analytics for Admin 2.0 phase 1.
-- Payloads are deliberately fixed columns: no free-form text, PII or user-supplied metadata.

CREATE TABLE public.account_analytics_events (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'first_login', 'product_opened', 'flow_step_reached', 'generation_clicked'
  )),
  product_id TEXT NULL CHECK (product_id IS NULL OR product_id IN (
    'raio_x', 'video_imobiliario', 'banner_imobiliario', 'studio_ia',
    'smart_carrossel', 'smart_space', 'banners_rapidos', 'campanha_textos'
  )),
  step_id TEXT NULL CHECK (step_id IS NULL OR step_id IN (
    'flow_started', 'details', 'upload', 'review'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT account_analytics_event_shape CHECK (
    (event_type = 'first_login' AND product_id IS NULL AND step_id IS NULL)
    OR (event_type IN ('product_opened', 'generation_clicked') AND product_id IS NOT NULL AND step_id IS NULL)
    OR (event_type = 'flow_step_reached' AND product_id IS NOT NULL AND step_id IS NOT NULL)
  )
);

CREATE INDEX account_analytics_user_created_idx
  ON public.account_analytics_events(user_id, created_at DESC, id DESC);
CREATE INDEX account_analytics_user_type_created_idx
  ON public.account_analytics_events(user_id, event_type, created_at DESC);
CREATE INDEX account_analytics_retention_idx
  ON public.account_analytics_events(created_at);
CREATE UNIQUE INDEX account_analytics_first_login_unique
  ON public.account_analytics_events(user_id, event_type)
  WHERE event_type = 'first_login';

ALTER TABLE public.account_analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_analytics_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.account_analytics_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON TABLE public.account_analytics_events TO service_role;

CREATE OR REPLACE FUNCTION public.track_account_analytics_event(
  p_event_type TEXT,
  p_product_id TEXT DEFAULT NULL,
  p_step_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_event_type TEXT := pg_catalog.btrim(COALESCE(p_event_type, ''));
  v_product_id TEXT := NULLIF(pg_catalog.btrim(COALESCE(p_product_id, '')), '');
  v_step_id TEXT := NULLIF(pg_catalog.btrim(COALESCE(p_step_id, '')), '');
BEGIN
  IF auth.role() <> 'authenticated' OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;

  IF v_event_type NOT IN ('first_login', 'product_opened', 'flow_step_reached', 'generation_clicked') THEN
    RAISE EXCEPTION 'invalid_event_type' USING ERRCODE = '22023';
  END IF;
  IF v_product_id IS NOT NULL AND v_product_id NOT IN (
    'raio_x', 'video_imobiliario', 'banner_imobiliario', 'studio_ia',
    'smart_carrossel', 'smart_space', 'banners_rapidos', 'campanha_textos'
  ) THEN
    RAISE EXCEPTION 'invalid_product_id' USING ERRCODE = '22023';
  END IF;
  IF v_step_id IS NOT NULL AND v_step_id NOT IN ('flow_started', 'details', 'upload', 'review') THEN
    RAISE EXCEPTION 'invalid_step_id' USING ERRCODE = '22023';
  END IF;
  IF NOT (
    (v_event_type = 'first_login' AND v_product_id IS NULL AND v_step_id IS NULL)
    OR (v_event_type IN ('product_opened', 'generation_clicked') AND v_product_id IS NOT NULL AND v_step_id IS NULL)
    OR (v_event_type = 'flow_step_reached' AND v_product_id IS NOT NULL AND v_step_id IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'invalid_event_shape' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.account_analytics_events(user_id, event_type, product_id, step_id)
  VALUES (v_user_id, v_event_type, v_product_id, v_step_id)
  ON CONFLICT (user_id, event_type) WHERE event_type = 'first_login' DO NOTHING;
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.track_account_analytics_event(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.track_account_analytics_event(TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_client_usage_metrics(p_user_ids UUID[])
RETURNS TABLE (
  user_id UUID,
  last_login_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  last_product_id TEXT,
  products_opened BIGINT,
  tracking_started_at TIMESTAMPTZ,
  has_tracking BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH requested_users AS (
    SELECT DISTINCT requested.user_id
    FROM pg_catalog.unnest(COALESCE(p_user_ids, ARRAY[]::UUID[])) requested(user_id)
    WHERE requested.user_id IS NOT NULL
  ), event_rollup AS (
    SELECT event.user_id,
      MAX(event.created_at) AS last_event_at,
      MIN(event.created_at) AS first_event_at,
      COUNT(DISTINCT event.product_id) FILTER (WHERE event.event_type = 'product_opened')::BIGINT AS products_opened
    FROM public.account_analytics_events event
    WHERE event.user_id = ANY(COALESCE(p_user_ids, ARRAY[]::UUID[]))
    GROUP BY event.user_id
  ), last_products AS (
    SELECT DISTINCT ON (event.user_id) event.user_id, event.product_id
    FROM public.account_analytics_events event
    WHERE event.user_id = ANY(COALESCE(p_user_ids, ARRAY[]::UUID[]))
      AND event.event_type = 'product_opened'
    ORDER BY event.user_id, event.created_at DESC, event.id DESC
  ), generation_rollup AS (
    SELECT metric.user_id, metric.last_generation_at
    FROM public.admin_client_activity_metrics(COALESCE(p_user_ids, ARRAY[]::UUID[])) metric
  )
  SELECT requested.user_id,
    auth_user.last_sign_in_at,
    GREATEST(
      auth_user.last_sign_in_at,
      event_rollup.last_event_at,
      generation_rollup.last_generation_at
    ),
    last_products.product_id,
    COALESCE(event_rollup.products_opened, 0)::BIGINT,
    event_rollup.first_event_at,
    (event_rollup.user_id IS NOT NULL)
  FROM requested_users requested
  LEFT JOIN auth.users auth_user ON auth_user.id = requested.user_id
  LEFT JOIN event_rollup ON event_rollup.user_id = requested.user_id
  LEFT JOIN last_products ON last_products.user_id = requested.user_id
  LEFT JOIN generation_rollup ON generation_rollup.user_id = requested.user_id
  WHERE auth.role() = 'service_role';
$$;

CREATE OR REPLACE FUNCTION public.admin_client_activity_timeline(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  event_type TEXT,
  product_id TEXT,
  step_id TEXT,
  occurred_at TIMESTAMPTZ,
  source TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH generation_requests AS (
    SELECT request.user_id,
      CASE request.product_code
        WHEN 'life_in_property' THEN 'smart_space'
        WHEN 'broker_presentation' THEN 'smart_space'
        ELSE 'video_imobiliario'
      END AS product_id,
      request.status,
      request.created_at,
      COALESCE(request.completed_at, request.failed_at, request.updated_at) AS terminal_at
    FROM public.gemini_video_economy_requests request WHERE request.user_id = p_user_id AND request.status <> 'insufficient'
    UNION ALL
    SELECT request.user_id, 'studio_ia', request.status, request.created_at,
      COALESCE(request.completed_at, request.failed_at, request.updated_at)
    FROM public.veo_video_economy_requests request WHERE request.user_id = p_user_id AND request.status <> 'insufficient'
    UNION ALL
    SELECT request.user_id, 'campanha_textos', request.status, request.created_at,
      COALESCE(request.completed_at, request.updated_at)
    FROM public.text_campaign_delivery_requests request WHERE request.user_id = p_user_id AND request.status <> 'expired'
    UNION ALL
    SELECT request.user_id, 'smart_carrossel',
      CASE request.status WHEN 'succeeded' THEN 'completed' ELSE request.status END,
      request.created_at, COALESCE(request.completed_at, request.failed_at, request.updated_at)
    FROM public.smart_carousel_economy_requests request WHERE request.user_id = p_user_id AND request.status <> 'insufficient'
    UNION ALL
    SELECT request.user_id, 'banner_imobiliario', request.status, request.created_at,
      COALESCE(request.completed_at, request.created_at)
    FROM public.real_estate_banner_requests request WHERE request.user_id = p_user_id
    UNION ALL
    SELECT request.user_id, 'banners_rapidos', request.status, request.created_at,
      COALESCE(request.completed_at, request.created_at)
    FROM public.quick_banner_delivery_requests request WHERE request.user_id = p_user_id
    UNION ALL
    SELECT request.user_id, 'smart_space', request.status, request.created_at,
      COALESCE(request.completed_at, request.created_at)
    FROM public.virtual_staging_image_requests request WHERE request.user_id = p_user_id
    UNION ALL
    SELECT request.user_id, 'raio_x', request.status, request.created_at,
      COALESCE(request.completed_at, request.updated_at)
    FROM public.listing_xray_requests request WHERE request.user_id = p_user_id AND request.status <> 'expired'
  ), normalized AS (
    SELECT 'login'::TEXT AS event_type, NULL::TEXT AS product_id, NULL::TEXT AS step_id,
      auth_user.last_sign_in_at AS occurred_at, 'auth'::TEXT AS source
    FROM auth.users auth_user
    WHERE auth_user.id = p_user_id AND auth_user.last_sign_in_at IS NOT NULL
    UNION ALL
    SELECT 'generation_started'::TEXT AS event_type, request.product_id::TEXT, NULL::TEXT AS step_id,
      request.created_at AS occurred_at, 'generation_backend'::TEXT AS source
    FROM generation_requests request
    UNION ALL
    SELECT CASE request.status WHEN 'completed' THEN 'generation_completed' ELSE 'generation_failed' END,
      request.product_id, NULL::TEXT, request.terminal_at, 'generation_backend'::TEXT
    FROM generation_requests request
    WHERE request.status IN ('completed', 'failed') AND request.terminal_at IS NOT NULL
    UNION ALL
    SELECT event.event_type, event.product_id, event.step_id, event.created_at, 'account_analytics'
    FROM public.account_analytics_events event
    WHERE event.user_id = p_user_id
  )
  SELECT normalized.event_type, normalized.product_id, normalized.step_id,
    normalized.occurred_at, normalized.source
  FROM normalized
  WHERE auth.role() = 'service_role'
  ORDER BY normalized.occurred_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 100), 200));
$$;

CREATE OR REPLACE FUNCTION public.purge_account_analytics_events(
  p_before TIMESTAMPTZ DEFAULT pg_catalog.now() - INTERVAL '180 days'
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_deleted BIGINT;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501';
  END IF;
  IF p_before IS NULL OR p_before > pg_catalog.now() - INTERVAL '30 days' THEN
    RAISE EXCEPTION 'retention_window_too_short' USING ERRCODE = '22023';
  END IF;
  DELETE FROM public.account_analytics_events WHERE created_at < p_before;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_client_usage_metrics(UUID[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_client_activity_timeline(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.purge_account_analytics_events(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_client_usage_metrics(UUID[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_client_activity_timeline(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_account_analytics_events(TIMESTAMPTZ) TO service_role;
