-- Forward-only upgrade from the Raio-X schema already recorded remotely as
-- 20260830010000. Do not rewrite or replay that historical migration.
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.listing_xray_requests') IS NULL THEN
    RAISE EXCEPTION 'listing_xray_base_schema_missing';
  END IF;
  IF EXISTS (SELECT 1 FROM public.listing_xray_requests WHERE status = 'processing') THEN
    RAISE EXCEPTION 'listing_xray_active_requests_prevent_upgrade';
  END IF;
  -- The historical version had no economic settlement. A completed row cannot
  -- be upgraded safely without an explicit reconciliation decision.
  IF EXISTS (SELECT 1 FROM public.listing_xray_requests WHERE status = 'completed') THEN
    RAISE EXCEPTION 'listing_xray_historical_completed_requires_reconciliation';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.listing_xray_requests
    WHERE status <> 'completed' AND (result IS NOT NULL OR completed_at IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'listing_xray_historical_terminal_shape_invalid';
  END IF;
END;
$$;

ALTER TABLE public.listing_xray_requests
  ADD COLUMN IF NOT EXISTS input_kind TEXT,
  ADD COLUMN IF NOT EXISTS image_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS content_type_hint TEXT,
  ADD COLUMN IF NOT EXISTS continuation JSONB,
  ADD COLUMN IF NOT EXISTS catalog_version TEXT DEFAULT '2026-08-20.virtual-staging.v1',
  ADD COLUMN IF NOT EXISTS smart_tokens_quoted BIGINT DEFAULT 10,
  ADD COLUMN IF NOT EXISTS smart_tokens_reserved BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS smart_tokens_consumed BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS smart_tokens_refunded BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reservation_id UUID,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Deterministic, economically neutral backfill. The one known historical row
-- is terminal/insufficient and remains uncharged, with no synthetic reservation.
UPDATE public.listing_xray_requests
SET input_kind = CASE
      WHEN source_domain = 'user-upload' OR source_url_sanitized LIKE 'images:%' THEN 'images'
      ELSE 'url'
    END,
    image_count = COALESCE(image_count, 0),
    catalog_version = COALESCE(catalog_version, '2026-08-20.virtual-staging.v1'),
    smart_tokens_quoted = 10,
    smart_tokens_reserved = 0,
    smart_tokens_consumed = 0,
    smart_tokens_refunded = 0,
    reservation_id = NULL,
    idempotency_key = COALESCE(idempotency_key, 'listing_xray:' || user_id::TEXT || ':' || client_request_id::TEXT)
WHERE input_kind IS NULL
   OR image_count IS NULL
   OR catalog_version IS NULL
   OR smart_tokens_quoted IS NULL
   OR smart_tokens_reserved IS NULL
   OR smart_tokens_consumed IS NULL
   OR smart_tokens_refunded IS NULL
   OR idempotency_key IS NULL;

ALTER TABLE public.listing_xray_requests
  ALTER COLUMN input_kind SET NOT NULL,
  ALTER COLUMN image_count SET DEFAULT 0,
  ALTER COLUMN image_count SET NOT NULL,
  ALTER COLUMN catalog_version SET DEFAULT '2026-08-20.virtual-staging.v1',
  ALTER COLUMN catalog_version SET NOT NULL,
  ALTER COLUMN smart_tokens_quoted SET DEFAULT 10,
  ALTER COLUMN smart_tokens_quoted SET NOT NULL,
  ALTER COLUMN smart_tokens_reserved SET DEFAULT 0,
  ALTER COLUMN smart_tokens_reserved SET NOT NULL,
  ALTER COLUMN smart_tokens_consumed SET DEFAULT 0,
  ALTER COLUMN smart_tokens_consumed SET NOT NULL,
  ALTER COLUMN smart_tokens_refunded SET DEFAULT 0,
  ALTER COLUMN smart_tokens_refunded SET NOT NULL,
  ALTER COLUMN idempotency_key SET NOT NULL;

ALTER TABLE public.listing_xray_requests
  DROP CONSTRAINT IF EXISTS listing_xray_requests_status_check,
  DROP CONSTRAINT IF EXISTS listing_xray_terminal_result,
  DROP CONSTRAINT IF EXISTS listing_xray_requests_input_kind_check,
  DROP CONSTRAINT IF EXISTS listing_xray_requests_image_count_check,
  DROP CONSTRAINT IF EXISTS listing_xray_requests_content_type_hint_check,
  DROP CONSTRAINT IF EXISTS listing_xray_requests_continuation_check,
  DROP CONSTRAINT IF EXISTS listing_xray_requests_smart_tokens_quoted_check,
  DROP CONSTRAINT IF EXISTS listing_xray_requests_smart_tokens_reserved_check,
  DROP CONSTRAINT IF EXISTS listing_xray_requests_smart_tokens_consumed_check,
  DROP CONSTRAINT IF EXISTS listing_xray_requests_smart_tokens_refunded_check,
  DROP CONSTRAINT IF EXISTS listing_xray_economic_resolution,
  DROP CONSTRAINT IF EXISTS listing_xray_economy_key_unique,
  DROP CONSTRAINT IF EXISTS listing_xray_requests_reservation_id_fkey;

ALTER TABLE public.listing_xray_requests
  ADD CONSTRAINT listing_xray_requests_status_check
    CHECK (status IN ('processing','awaiting_input','completed','insufficient','failed','expired')),
  ADD CONSTRAINT listing_xray_requests_input_kind_check
    CHECK (input_kind IN ('url','images')),
  ADD CONSTRAINT listing_xray_requests_image_count_check
    CHECK (image_count BETWEEN 0 AND 5),
  ADD CONSTRAINT listing_xray_requests_content_type_hint_check
    CHECK (content_type_hint IS NULL OR content_type_hint IN ('PROPERTY_LISTING','SOCIAL_PUBLICATION')),
  ADD CONSTRAINT listing_xray_requests_continuation_check
    CHECK (continuation IS NULL OR pg_catalog.jsonb_typeof(continuation) = 'object'),
  ADD CONSTRAINT listing_xray_requests_smart_tokens_quoted_check
    CHECK (smart_tokens_quoted = 10),
  ADD CONSTRAINT listing_xray_requests_smart_tokens_reserved_check
    CHECK (smart_tokens_reserved IN (0,10)),
  ADD CONSTRAINT listing_xray_requests_smart_tokens_consumed_check
    CHECK (smart_tokens_consumed IN (0,10)),
  ADD CONSTRAINT listing_xray_requests_smart_tokens_refunded_check
    CHECK (smart_tokens_refunded IN (0,10)),
  ADD CONSTRAINT listing_xray_requests_reservation_id_fkey
    FOREIGN KEY (reservation_id) REFERENCES public.credit_reservations(id) ON DELETE RESTRICT,
  ADD CONSTRAINT listing_xray_economy_key_unique UNIQUE (user_id, idempotency_key),
  ADD CONSTRAINT listing_xray_terminal_result
    CHECK (
      (status='completed' AND result IS NOT NULL AND completed_at IS NOT NULL AND smart_tokens_consumed=10)
      OR (status<>'completed' AND result IS NULL AND completed_at IS NULL)
    ),
  ADD CONSTRAINT listing_xray_economic_resolution
    CHECK (smart_tokens_consumed + smart_tokens_refunded <= smart_tokens_reserved);

-- Changed signatures must be removed explicitly or PostgreSQL would keep the
-- historical overload callable beside the approved contract.
DROP FUNCTION IF EXISTS public.claim_listing_xray_request(UUID,UUID,TEXT,TEXT,TEXT);
DROP FUNCTION IF EXISTS public.finish_listing_xray_without_result(UUID,UUID,UUID,TEXT,TEXT,JSONB);

CREATE OR REPLACE FUNCTION public.claim_listing_xray_request(
  p_user_id UUID,p_client_request_id UUID,p_input_kind TEXT,p_source_domain TEXT,p_source_url_hash TEXT,
  p_source_url_sanitized TEXT,p_image_count INTEGER DEFAULT 0,p_content_type_hint TEXT DEFAULT NULL
)
RETURNS TABLE (
  request_id UUID,request_status TEXT,returned_claim_token UUID,returned_reservation_id UUID,
  returned_result JSONB,returned_continuation JSONB,returned_error_code TEXT,returned_expires_at TIMESTAMPTZ,
  returned_reserved_tokens BIGINT,returned_consumed_tokens BIGINT,returned_refunded_tokens BIGINT,
  claimed BOOLEAN,rate_limited BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_request public.listing_xray_requests%ROWTYPE;
  v_reservation public.credit_reservations%ROWTYPE;
  v_claim UUID := pg_catalog.gen_random_uuid();
  v_key TEXT := 'listing_xray:'||p_user_id::TEXT||':'||p_client_request_id::TEXT;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;
  IF p_user_id IS NULL OR p_client_request_id IS NULL OR p_input_kind NOT IN ('url','images') OR p_source_domain IS NULL OR p_source_url_hash !~ '^[0-9a-f]{64}$'
     OR p_image_count NOT BETWEEN 0 AND 5 OR (p_input_kind='url' AND p_image_count<>0) OR (p_input_kind='images' AND p_image_count<1)
     OR (p_content_type_hint IS NOT NULL AND p_content_type_hint NOT IN ('PROPERTY_LISTING','SOCIAL_PUBLICATION')) THEN
    RAISE EXCEPTION 'invalid_listing_xray_identity';
  END IF;

  SELECT * INTO v_request FROM public.listing_xray_requests r
   WHERE r.user_id=p_user_id AND r.product_code='listing_xray' AND r.client_request_id=p_client_request_id FOR UPDATE;
  IF FOUND THEN
    IF v_request.status IN ('processing','awaiting_input') AND v_request.expires_at<=pg_catalog.now() THEN
      IF v_request.reservation_id IS NOT NULL THEN PERFORM public.cancel_credit_reservation_from_lots(v_request.user_id,v_request.idempotency_key,'listing_xray_expired'); END IF;
      UPDATE public.listing_xray_requests SET status='expired',smart_tokens_refunded=smart_tokens_reserved,error_code='request_expired',continuation=NULL,updated_at=pg_catalog.now() WHERE id=v_request.id RETURNING * INTO v_request;
    ELSIF v_request.status='awaiting_input' THEN
      IF v_request.input_kind<>'images' OR p_input_kind<>'images' THEN RAISE EXCEPTION 'invalid_listing_xray_continuation'; END IF;
      UPDATE public.listing_xray_requests SET status='processing',claim_token=v_claim,image_count=p_image_count,content_type_hint=p_content_type_hint,
        continuation=NULL,error_code=NULL,expires_at=pg_catalog.now()+INTERVAL '3 minutes',updated_at=pg_catalog.now()
       WHERE id=v_request.id RETURNING * INTO v_request;
      RETURN QUERY SELECT v_request.id,v_request.status,v_request.claim_token,v_request.reservation_id,v_request.result,v_request.continuation,v_request.error_code,v_request.expires_at,
        v_request.smart_tokens_reserved,v_request.smart_tokens_consumed,v_request.smart_tokens_refunded,TRUE,FALSE;
      RETURN;
    END IF;
    RETURN QUERY SELECT v_request.id,v_request.status,NULL::UUID,v_request.reservation_id,v_request.result,v_request.continuation,v_request.error_code,v_request.expires_at,
      v_request.smart_tokens_reserved,v_request.smart_tokens_consumed,v_request.smart_tokens_refunded,FALSE,FALSE;
    RETURN;
  END IF;

  IF (SELECT pg_catalog.count(*) FROM public.listing_xray_requests r WHERE r.user_id=p_user_id AND r.created_at>pg_catalog.now()-INTERVAL '1 hour' AND r.status IN ('processing','awaiting_input','completed','failed')) >= 5
     OR (SELECT pg_catalog.count(*) FROM public.listing_xray_requests r WHERE r.user_id=p_user_id AND r.created_at>pg_catalog.now()-INTERVAL '24 hours' AND r.status IN ('processing','awaiting_input','completed','failed')) >= 20 THEN
    RETURN QUERY SELECT NULL::UUID,'rate_limited'::TEXT,NULL::UUID,NULL::UUID,NULL::JSONB,NULL::JSONB,'rate_limited'::TEXT,pg_catalog.now()+INTERVAL '1 hour',0::BIGINT,0::BIGINT,0::BIGINT,FALSE,TRUE;
    RETURN;
  END IF;

  SELECT * INTO v_reservation FROM public.reserve_credits_from_lots(p_user_id,10,v_key,NULL,'listing_xray:analysis',
    pg_catalog.jsonb_build_object('product_code','listing_xray','variant','analysis','smart_token_cost',10,'client_request_id',p_client_request_id,'input_kind',p_input_kind));
  IF v_reservation.id IS NULL OR v_reservation.status<>'reserved' OR v_reservation.amount<>10 THEN RAISE EXCEPTION 'listing_xray_reservation_failed'; END IF;

  INSERT INTO public.listing_xray_requests(user_id,client_request_id,input_kind,image_count,content_type_hint,source_domain,source_url_hash,source_url_sanitized,status,claim_token,reservation_id,idempotency_key,smart_tokens_reserved,expires_at)
  VALUES(p_user_id,p_client_request_id,p_input_kind,p_image_count,p_content_type_hint,pg_catalog.lower(pg_catalog.btrim(p_source_domain)),p_source_url_hash,p_source_url_sanitized,'processing',v_claim,v_reservation.id,v_key,10,pg_catalog.now()+INTERVAL '3 minutes')
  RETURNING * INTO v_request;
  RETURN QUERY SELECT v_request.id,v_request.status,v_request.claim_token,v_request.reservation_id,v_request.result,v_request.continuation,v_request.error_code,v_request.expires_at,
    v_request.smart_tokens_reserved,v_request.smart_tokens_consumed,v_request.smart_tokens_refunded,TRUE,FALSE;
END; $$;

CREATE OR REPLACE FUNCTION public.complete_listing_xray_request(
  p_user_id UUID,p_client_request_id UUID,p_claim_token UUID,p_normalized_facts JSONB,p_result JSONB,
  p_provider_model TEXT,p_usage JSONB,p_duration_ms INTEGER
)
RETURNS SETOF public.listing_xray_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_request public.listing_xray_requests%ROWTYPE; v_reservation public.credit_reservations%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;
  IF p_result IS NULL OR pg_catalog.jsonb_typeof(p_result)<>'object' OR pg_catalog.octet_length(p_result::TEXT)>524288 THEN RAISE EXCEPTION 'invalid_listing_xray_result'; END IF;
  SELECT * INTO v_request FROM public.listing_xray_requests r WHERE r.user_id=p_user_id AND r.client_request_id=p_client_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'listing_xray_not_found'; END IF;
  IF v_request.status='completed' THEN RETURN NEXT v_request; RETURN; END IF;
  IF v_request.status<>'processing' OR v_request.claim_token<>p_claim_token OR v_request.expires_at<=pg_catalog.now() OR v_request.reservation_id IS NULL OR v_request.smart_tokens_reserved<>10 THEN RAISE EXCEPTION 'invalid_listing_xray_claim'; END IF;
  SELECT * INTO v_reservation FROM public.consume_reserved_credits_from_lots(p_user_id,v_request.idempotency_key,'Raio-X entregue',
    pg_catalog.jsonb_build_object('product_code','listing_xray','client_request_id',p_client_request_id,'smart_tokens_consumed',10));
  IF v_reservation.status<>'consumed' OR v_reservation.amount<>10 THEN RAISE EXCEPTION 'listing_xray_settlement_failed'; END IF;
  UPDATE public.listing_xray_requests SET status='completed',normalized_facts=p_normalized_facts,result=p_result,provider_model=p_provider_model,
    input_tokens=COALESCE((p_usage->>'input_tokens')::INTEGER,0),output_tokens=COALESCE((p_usage->>'output_tokens')::INTEGER,0),total_tokens=COALESCE((p_usage->>'total_tokens')::INTEGER,0),estimated_cost_usd=COALESCE((p_usage->>'estimated_cost_usd')::NUMERIC,0),
    smart_tokens_consumed=10,smart_tokens_refunded=0,duration_ms=p_duration_ms,error_code=NULL,continuation=NULL,completed_at=pg_catalog.now(),expires_at=pg_catalog.now()+INTERVAL '24 hours',updated_at=pg_catalog.now()
   WHERE id=v_request.id RETURNING * INTO v_request;
  INSERT INTO public.economic_generation_events(user_id,reservation_id,product_code,variant,provider,model,quantity,usage,estimated_cost_micros,currency,catalog_version,status,idempotency_key,metadata)
  VALUES(p_user_id,v_request.reservation_id,'listing_xray','analysis','openai',p_provider_model,1,COALESCE(p_usage,'{}'::JSONB),pg_catalog.round(COALESCE((p_usage->>'estimated_cost_usd')::NUMERIC,0)*1000000)::BIGINT,'USD',v_request.catalog_version,'delivered','listing_xray:delivery:'||v_request.id,
    pg_catalog.jsonb_build_object('input_kind',v_request.input_kind,'image_count',v_request.image_count,'smart_tokens_reserved',10,'smart_tokens_consumed',10,'smart_tokens_refunded',0))
  ON CONFLICT(idempotency_key) DO UPDATE SET status=EXCLUDED.status,usage=EXCLUDED.usage,estimated_cost_micros=EXCLUDED.estimated_cost_micros,metadata=EXCLUDED.metadata;
  RETURN NEXT v_request;
END; $$;

CREATE OR REPLACE FUNCTION public.await_listing_xray_input(
  p_user_id UUID,p_client_request_id UUID,p_claim_token UUID,p_error_code TEXT,p_continuation JSONB,p_usage JSONB,p_provider_model TEXT
)
RETURNS SETOF public.listing_xray_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_request public.listing_xray_requests%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;
  IF p_error_code NOT IN ('additional_image_required','classification_required') OR pg_catalog.jsonb_typeof(p_continuation)<>'object' THEN RAISE EXCEPTION 'invalid_listing_xray_continuation'; END IF;
  SELECT * INTO v_request FROM public.listing_xray_requests r WHERE r.user_id=p_user_id AND r.client_request_id=p_client_request_id FOR UPDATE;
  IF NOT FOUND OR v_request.status<>'processing' OR v_request.claim_token<>p_claim_token OR v_request.input_kind<>'images' THEN RAISE EXCEPTION 'invalid_listing_xray_claim'; END IF;
  UPDATE public.listing_xray_requests SET status='awaiting_input',continuation=p_continuation,error_code=p_error_code,provider_model=p_provider_model,
    input_tokens=input_tokens+COALESCE((p_usage->>'input_tokens')::INTEGER,0),output_tokens=output_tokens+COALESCE((p_usage->>'output_tokens')::INTEGER,0),total_tokens=total_tokens+COALESCE((p_usage->>'total_tokens')::INTEGER,0),estimated_cost_usd=estimated_cost_usd+COALESCE((p_usage->>'estimated_cost_usd')::NUMERIC,0),
    expires_at=pg_catalog.now()+INTERVAL '30 minutes',updated_at=pg_catalog.now() WHERE id=v_request.id RETURNING * INTO v_request;
  RETURN NEXT v_request;
END; $$;

CREATE OR REPLACE FUNCTION public.finish_listing_xray_without_result(
  p_user_id UUID,p_client_request_id UUID,p_claim_token UUID,p_status TEXT,p_error_code TEXT,p_normalized_facts JSONB DEFAULT NULL,p_usage JSONB DEFAULT '{}'::JSONB,p_provider_model TEXT DEFAULT NULL
)
RETURNS SETOF public.listing_xray_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_request public.listing_xray_requests%ROWTYPE; v_reservation public.credit_reservations%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;
  IF p_status NOT IN ('insufficient','failed') OR p_error_code IS NULL OR pg_catalog.octet_length(p_error_code)>120 THEN RAISE EXCEPTION 'invalid_listing_xray_terminal_state'; END IF;
  SELECT * INTO v_request FROM public.listing_xray_requests r WHERE r.user_id=p_user_id AND r.client_request_id=p_client_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'listing_xray_not_found'; END IF;
  IF v_request.status IN ('completed','insufficient','failed','expired') THEN RETURN NEXT v_request; RETURN; END IF;
  IF v_request.status<>'processing' OR v_request.claim_token<>p_claim_token THEN RAISE EXCEPTION 'invalid_listing_xray_claim'; END IF;
  IF v_request.reservation_id IS NOT NULL THEN SELECT * INTO v_reservation FROM public.cancel_credit_reservation_from_lots(p_user_id,v_request.idempotency_key,p_error_code); END IF;
  UPDATE public.listing_xray_requests SET status=p_status,normalized_facts=p_normalized_facts,result=NULL,error_code=p_error_code,provider_model=COALESCE(p_provider_model,provider_model),
    input_tokens=input_tokens+COALESCE((p_usage->>'input_tokens')::INTEGER,0),output_tokens=output_tokens+COALESCE((p_usage->>'output_tokens')::INTEGER,0),total_tokens=total_tokens+COALESCE((p_usage->>'total_tokens')::INTEGER,0),estimated_cost_usd=estimated_cost_usd+COALESCE((p_usage->>'estimated_cost_usd')::NUMERIC,0),
    smart_tokens_consumed=0,smart_tokens_refunded=smart_tokens_reserved,continuation=NULL,expires_at=pg_catalog.now()+INTERVAL '1 hour',updated_at=pg_catalog.now()
   WHERE id=v_request.id RETURNING * INTO v_request;
  INSERT INTO public.economic_generation_events(user_id,reservation_id,product_code,variant,provider,model,quantity,usage,estimated_cost_micros,currency,catalog_version,status,idempotency_key,metadata)
  VALUES(p_user_id,v_request.reservation_id,'listing_xray','analysis','openai',p_provider_model,1,COALESCE(p_usage,'{}'::JSONB),pg_catalog.round(COALESCE((p_usage->>'estimated_cost_usd')::NUMERIC,0)*1000000)::BIGINT,'USD',v_request.catalog_version,'refunded','listing_xray:delivery:'||v_request.id,
    pg_catalog.jsonb_build_object('input_kind',v_request.input_kind,'image_count',v_request.image_count,'failure_reason',p_error_code,'smart_tokens_reserved',v_request.smart_tokens_reserved,'smart_tokens_consumed',0,'smart_tokens_refunded',v_request.smart_tokens_reserved))
  ON CONFLICT(idempotency_key) DO UPDATE SET status=EXCLUDED.status,usage=EXCLUDED.usage,estimated_cost_micros=EXCLUDED.estimated_cost_micros,metadata=EXCLUDED.metadata;
  RETURN NEXT v_request;
END; $$;

CREATE OR REPLACE FUNCTION public.get_listing_xray_request(p_user_id UUID,p_client_request_id UUID)
RETURNS SETOF public.listing_xray_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;
  RETURN QUERY SELECT * FROM public.listing_xray_requests r WHERE r.user_id=p_user_id AND r.client_request_id=p_client_request_id AND r.expires_at>pg_catalog.now();
END; $$;

CREATE OR REPLACE FUNCTION public.cleanup_listing_xray_requests()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_count INTEGER:=0; v_request public.listing_xray_requests%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;
  FOR v_request IN SELECT * FROM public.listing_xray_requests WHERE status IN ('processing','awaiting_input') AND expires_at<=pg_catalog.now() FOR UPDATE LOOP
    IF v_request.reservation_id IS NOT NULL THEN PERFORM public.cancel_credit_reservation_from_lots(v_request.user_id,v_request.idempotency_key,'listing_xray_expired'); END IF;
    UPDATE public.listing_xray_requests SET status='expired',result=NULL,normalized_facts=NULL,continuation=NULL,error_code='request_expired',smart_tokens_refunded=smart_tokens_reserved,updated_at=pg_catalog.now() WHERE id=v_request.id;
    v_count:=v_count+1;
  END LOOP;
  WITH expired AS (UPDATE public.listing_xray_requests SET status='expired',result=NULL,normalized_facts=NULL,continuation=NULL,updated_at=pg_catalog.now() WHERE status IN ('completed','insufficient','failed') AND expires_at<=pg_catalog.now() RETURNING 1)
  SELECT v_count+pg_catalog.count(*)::INTEGER INTO v_count FROM expired;
  DELETE FROM public.listing_xray_requests WHERE status='expired' AND updated_at<pg_catalog.now()-INTERVAL '30 days';
  RETURN v_count;
END; $$;

REVOKE EXECUTE ON FUNCTION public.claim_listing_xray_request(UUID,UUID,TEXT,TEXT,TEXT,TEXT,INTEGER,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_listing_xray_request(UUID,UUID,UUID,JSONB,JSONB,TEXT,JSONB,INTEGER) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.await_listing_xray_input(UUID,UUID,UUID,TEXT,JSONB,JSONB,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.finish_listing_xray_without_result(UUID,UUID,UUID,TEXT,TEXT,JSONB,JSONB,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.get_listing_xray_request(UUID,UUID) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_listing_xray_requests() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_listing_xray_request(UUID,UUID,TEXT,TEXT,TEXT,TEXT,INTEGER,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_listing_xray_request(UUID,UUID,UUID,JSONB,JSONB,TEXT,JSONB,INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.await_listing_xray_input(UUID,UUID,UUID,TEXT,JSONB,JSONB,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_listing_xray_without_result(UUID,UUID,UUID,TEXT,TEXT,JSONB,JSONB,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_listing_xray_request(UUID,UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_listing_xray_requests() TO service_role;

COMMIT;
