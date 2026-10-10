-- Record only allowlisted pre-backend failure categories and include them in
-- the Admin failure count. No economic or generation records are changed.

ALTER TABLE public.account_analytics_events
  DROP CONSTRAINT account_analytics_events_event_type_check,
  DROP CONSTRAINT account_analytics_events_step_id_check,
  DROP CONSTRAINT account_analytics_event_shape;

ALTER TABLE public.account_analytics_events
  ADD CONSTRAINT account_analytics_events_event_type_check CHECK (event_type IN (
    'first_login', 'product_opened', 'flow_step_reached', 'generation_clicked',
    'generation_prebackend_failed'
  )),
  ADD CONSTRAINT account_analytics_events_step_id_check CHECK (step_id IS NULL OR step_id IN (
    'flow_started', 'details', 'upload', 'review',
    'session_missing', 'request_not_sent', 'image_preparation_failed'
  )),
  ADD CONSTRAINT account_analytics_event_shape CHECK (
    (event_type = 'first_login' AND product_id IS NULL AND step_id IS NULL)
    OR (event_type IN ('product_opened', 'generation_clicked') AND product_id IS NOT NULL AND step_id IS NULL)
    OR (event_type = 'flow_step_reached' AND product_id IS NOT NULL AND step_id IN ('flow_started', 'details', 'upload', 'review'))
    OR (event_type = 'generation_prebackend_failed' AND product_id IS NOT NULL
      AND step_id IN ('session_missing', 'request_not_sent', 'image_preparation_failed'))
  );

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
  IF v_event_type NOT IN ('first_login', 'product_opened', 'flow_step_reached', 'generation_clicked', 'generation_prebackend_failed') THEN
    RAISE EXCEPTION 'invalid_event_type' USING ERRCODE = '22023';
  END IF;
  IF v_product_id IS NOT NULL AND v_product_id NOT IN (
    'raio_x', 'video_imobiliario', 'banner_imobiliario', 'studio_ia',
    'smart_carrossel', 'smart_space', 'banners_rapidos', 'campanha_textos'
  ) THEN
    RAISE EXCEPTION 'invalid_product_id' USING ERRCODE = '22023';
  END IF;
  IF v_step_id IS NOT NULL AND v_step_id NOT IN (
    'flow_started', 'details', 'upload', 'review',
    'session_missing', 'request_not_sent', 'image_preparation_failed'
  ) THEN
    RAISE EXCEPTION 'invalid_step_id' USING ERRCODE = '22023';
  END IF;
  IF NOT (
    (v_event_type = 'first_login' AND v_product_id IS NULL AND v_step_id IS NULL)
    OR (v_event_type IN ('product_opened', 'generation_clicked') AND v_product_id IS NOT NULL AND v_step_id IS NULL)
    OR (v_event_type = 'flow_step_reached' AND v_product_id IS NOT NULL AND v_step_id IN ('flow_started', 'details', 'upload', 'review'))
    OR (v_event_type = 'generation_prebackend_failed' AND v_product_id IS NOT NULL
      AND v_step_id IN ('session_missing', 'request_not_sent', 'image_preparation_failed'))
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
