-- Smart Space: action-aware 30/60 ST economy and transactional two-stage resume.
-- Forward-only migration. It reuses the existing request/item/reservation tables.

ALTER TABLE public.virtual_staging_image_requests
  ADD COLUMN IF NOT EXISTS transformation_type TEXT,
  ADD COLUMN IF NOT EXISTS decoration_style TEXT;
UPDATE public.virtual_staging_image_requests
SET transformation_type = 'furnish',
    decoration_style = COALESCE(decoration_style,'cozy')
WHERE transformation_type IS NULL;
ALTER TABLE public.virtual_staging_image_requests
  ALTER COLUMN transformation_type SET NOT NULL,
  ALTER COLUMN transformation_type SET DEFAULT 'furnish',
  DROP CONSTRAINT IF EXISTS virtual_staging_image_requests_unit_cost_check,
  DROP CONSTRAINT IF EXISTS virtual_staging_image_requests_smart_tokens_quoted_check,
  DROP CONSTRAINT IF EXISTS virtual_staging_image_requests_smart_tokens_reserved_check,
  ADD CONSTRAINT virtual_staging_image_requests_transformation_type_check
    CHECK (transformation_type IN ('furnish','remove_furniture','remove_and_redecorate','clear_area')),
  ADD CONSTRAINT virtual_staging_image_requests_decoration_style_check
    CHECK (
      (transformation_type IN ('furnish','remove_and_redecorate') AND decoration_style IN ('cozy','contemporary'))
      OR (transformation_type IN ('remove_furniture','clear_area') AND decoration_style IS NULL)
    ),
  ADD CONSTRAINT virtual_staging_image_requests_unit_cost_check CHECK (unit_cost IN (30,60)),
  ADD CONSTRAINT virtual_staging_image_requests_smart_tokens_quoted_check CHECK (smart_tokens_quoted = image_count * unit_cost),
  ADD CONSTRAINT virtual_staging_image_requests_smart_tokens_reserved_check CHECK (smart_tokens_reserved IN (0,smart_tokens_quoted));
ALTER TABLE public.virtual_staging_image_items
  ADD COLUMN IF NOT EXISTS stage_state TEXT,
  ADD COLUMN IF NOT EXISTS stage_claim_token UUID,
  ADD COLUMN IF NOT EXISTS stage_claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stage_lease_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS free_space_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stage1_usage JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS stage2_usage JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS stage1_estimated_cost_usd_micros BIGINT,
  ADD COLUMN IF NOT EXISTS stage2_estimated_cost_usd_micros BIGINT,
  ADD COLUMN IF NOT EXISTS video_state TEXT NOT NULL DEFAULT 'not_requested',
  ADD COLUMN IF NOT EXISTS video_renderer TEXT,
  ADD COLUMN IF NOT EXISTS video_idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS video_render_id TEXT,
  ADD COLUMN IF NOT EXISTS video_output_path TEXT,
  ADD COLUMN IF NOT EXISTS video_failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS video_claim_token UUID,
  ADD COLUMN IF NOT EXISTS video_claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS video_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS video_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS video_failed_at TIMESTAMPTZ;
UPDATE public.virtual_staging_image_items
SET stage_state = CASE status WHEN 'completed' THEN 'completed' WHEN 'failed' THEN 'failed' WHEN 'processing' THEN 'removing' ELSE 'awaiting_processing' END
WHERE stage_state IS NULL;
ALTER TABLE public.virtual_staging_image_items
  ALTER COLUMN stage_state SET NOT NULL,
  ALTER COLUMN stage_state SET DEFAULT 'awaiting_processing',
  DROP CONSTRAINT IF EXISTS virtual_staging_image_items_unit_cost_check,
  DROP CONSTRAINT IF EXISTS virtual_staging_image_items_smart_tokens_consumed_check,
  ADD CONSTRAINT virtual_staging_image_items_unit_cost_check CHECK (unit_cost IN (30,60)),
  ADD CONSTRAINT virtual_staging_image_items_smart_tokens_consumed_check CHECK (smart_tokens_consumed IN (0,30,60)),
  ADD CONSTRAINT virtual_staging_image_items_stage_state_check CHECK (stage_state IN (
    'awaiting_processing','removing','free_space_completed','redecorating','completed','partial','failed'
  )),
  ADD CONSTRAINT virtual_staging_image_items_stage1_cost_check CHECK (stage1_estimated_cost_usd_micros IS NULL OR stage1_estimated_cost_usd_micros>=0),
  ADD CONSTRAINT virtual_staging_image_items_stage2_cost_check CHECK (stage2_estimated_cost_usd_micros IS NULL OR stage2_estimated_cost_usd_micros>=0);
ALTER TABLE public.virtual_staging_image_items
  DROP CONSTRAINT IF EXISTS virtual_staging_image_items_video_state_check,
  ADD CONSTRAINT virtual_staging_image_items_video_state_check CHECK (video_state IN (
    'not_requested','submitting','rendering','completed','failed_retryable','failed_unknown','skipped'
  ));
CREATE UNIQUE INDEX IF NOT EXISTS uq_virtual_staging_image_items_video_key
  ON public.virtual_staging_image_items(video_idempotency_key)
  WHERE video_idempotency_key IS NOT NULL;
ALTER TABLE public.virtual_staging_image_item_allocations
  ADD COLUMN IF NOT EXISTS consumed_amount BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refunded_amount BIGINT NOT NULL DEFAULT 0;
UPDATE public.virtual_staging_image_item_allocations
SET consumed_amount = CASE WHEN status='consumed' THEN amount ELSE 0 END,
    refunded_amount = CASE WHEN status IN ('refunded','expired') THEN amount ELSE 0 END;
ALTER TABLE public.virtual_staging_image_item_allocations
  ADD CONSTRAINT virtual_staging_image_item_allocations_split_check
    CHECK (consumed_amount>=0 AND refunded_amount>=0 AND consumed_amount+refunded_amount<=amount);
CREATE OR REPLACE FUNCTION public.prepare_smart_space_request(
  p_user_id UUID,p_client_request_id UUID,p_image_count INTEGER,p_transformation_type TEXT,
  p_decoration_style TEXT,p_catalog_version TEXT
)
RETURNS SETOF public.virtual_staging_image_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_request public.virtual_staging_image_requests%ROWTYPE;
  v_reservation public.credit_reservations%ROWTYPE;
  v_item public.virtual_staging_image_items%ROWTYPE;
  v_allocation RECORD; v_missing BIGINT; v_take BIGINT; v_index INTEGER;
  v_unit_cost BIGINT;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Nao autorizado' USING ERRCODE='42501'; END IF;
  IF p_image_count NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'quantidade de imagens invalida'; END IF;
  IF p_transformation_type NOT IN ('furnish','remove_furniture','remove_and_redecorate','clear_area') THEN RAISE EXCEPTION 'transformacao invalida'; END IF;
  IF (p_transformation_type IN ('furnish','remove_and_redecorate') AND (p_decoration_style IS NULL OR p_decoration_style NOT IN ('cozy','contemporary')))
    OR (p_transformation_type IN ('remove_furniture','clear_area') AND p_decoration_style IS NOT NULL) THEN
    RAISE EXCEPTION 'estilo invalido para transformacao';
  END IF;
  v_unit_cost:=CASE WHEN p_transformation_type='remove_and_redecorate' THEN 60 ELSE 30 END;

  INSERT INTO public.virtual_staging_image_requests(
    user_id,client_request_id,image_count,unit_cost,smart_tokens_quoted,catalog_version,transformation_type,decoration_style
  ) VALUES(
    p_user_id,p_client_request_id,p_image_count,v_unit_cost,p_image_count*v_unit_cost,p_catalog_version,p_transformation_type,p_decoration_style
  ) ON CONFLICT(user_id,client_request_id) DO NOTHING;
  SELECT * INTO v_request FROM public.virtual_staging_image_requests
   WHERE user_id=p_user_id AND client_request_id=p_client_request_id FOR UPDATE;
  IF v_request.image_count<>p_image_count OR v_request.unit_cost<>v_unit_cost
    OR v_request.smart_tokens_quoted<>p_image_count*v_unit_cost OR v_request.catalog_version<>p_catalog_version
    OR v_request.transformation_type<>p_transformation_type
    OR v_request.decoration_style IS DISTINCT FROM p_decoration_style THEN
    RAISE EXCEPTION 'request existente diverge da cotacao';
  END IF;
  IF v_request.reservation_id IS NOT NULL THEN RETURN NEXT v_request; RETURN; END IF;

  SELECT * INTO v_reservation FROM public.reserve_credits_from_lots(
    p_user_id,p_image_count*v_unit_cost,'virtual_staging:'||p_client_request_id,NULL,'Smart Space',
    pg_catalog.jsonb_build_object('product_code','virtual_staging','variant','image','image_count',p_image_count,
      'unit_cost',v_unit_cost,'transformation_type',p_transformation_type,'catalog_version',p_catalog_version)
  );
  UPDATE public.virtual_staging_image_requests
    SET reservation_id=v_reservation.id,smart_tokens_reserved=smart_tokens_quoted,status='processing'
    WHERE id=v_request.id RETURNING * INTO v_request;

  FOR v_index IN 0..p_image_count-1 LOOP
    INSERT INTO public.virtual_staging_image_items(request_id,item_index,unit_cost,stage_state)
    VALUES(v_request.id,v_index,v_unit_cost,'awaiting_processing') ON CONFLICT(request_id,item_index) DO NOTHING;
  END LOOP;
  FOR v_item IN SELECT * FROM public.virtual_staging_image_items WHERE request_id=v_request.id ORDER BY item_index FOR UPDATE LOOP
    IF v_item.unit_cost<>v_unit_cost THEN RAISE EXCEPTION 'item existente diverge da cotacao'; END IF;
    v_missing:=v_unit_cost;
    FOR v_allocation IN
      SELECT cra.lot_id,cra.amount-COALESCE((SELECT pg_catalog.sum(a.amount) FROM public.virtual_staging_image_item_allocations a
        JOIN public.virtual_staging_image_items i ON i.id=a.item_id WHERE i.request_id=v_request.id AND a.lot_id=cra.lot_id),0) AS available
      FROM public.credit_reservation_allocations cra JOIN public.credit_lots cl ON cl.id=cra.lot_id
      WHERE cra.reservation_id=v_reservation.id AND cra.status='reserved'
      ORDER BY cl.expires_at ASC NULLS LAST,cl.created_at,cl.id
    LOOP
      EXIT WHEN v_missing=0; IF v_allocation.available<=0 THEN CONTINUE; END IF;
      v_take:=LEAST(v_missing,v_allocation.available);
      INSERT INTO public.virtual_staging_image_item_allocations(item_id,lot_id,amount) VALUES(v_item.id,v_allocation.lot_id,v_take);
      v_missing:=v_missing-v_take;
    END LOOP;
    IF v_missing<>0 THEN RAISE EXCEPTION 'falha ao associar imagem aos lotes FEFO'; END IF;
  END LOOP;
  RETURN NEXT v_request;
END; $$;
CREATE OR REPLACE FUNCTION public.claim_smart_space_stage(
  p_user_id UUID,p_client_request_id UUID,p_item_index INTEGER,p_stage TEXT,p_lease_seconds INTEGER DEFAULT 300
)
RETURNS TABLE(returned_item JSONB,claimed BOOLEAN,claim_token UUID)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_item public.virtual_staging_image_items%ROWTYPE; v_request public.virtual_staging_image_requests%ROWTYPE;
  v_claimed BOOLEAN:=FALSE; v_token UUID:=NULL; v_now TIMESTAMPTZ:=pg_catalog.now();
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Nao autorizado' USING ERRCODE='42501'; END IF;
  IF p_lease_seconds NOT BETWEEN 180 AND 900 THEN RAISE EXCEPTION 'lease invalido'; END IF;
  SELECT r.* INTO v_request FROM public.virtual_staging_image_requests r
   WHERE r.user_id=p_user_id AND r.client_request_id=p_client_request_id AND r.status='processing' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request economico nao encontrado'; END IF;
  SELECT * INTO v_item FROM public.virtual_staging_image_items
   WHERE request_id=v_request.id AND item_index=p_item_index FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'imagem economica nao encontrada'; END IF;

  IF p_stage='single' AND v_request.transformation_type<>'remove_and_redecorate'
    AND v_item.stage_state='awaiting_processing' THEN
    v_claimed:=TRUE;
  ELSIF p_stage='remove' AND v_request.transformation_type='remove_and_redecorate'
    AND v_item.stage_state='awaiting_processing' THEN
    v_claimed:=TRUE;
  ELSIF p_stage='redecorate' AND v_request.transformation_type='remove_and_redecorate'
    AND v_item.stage_state='free_space_completed' THEN
    v_claimed:=TRUE;
  END IF;

  IF v_claimed THEN
    v_token:=pg_catalog.gen_random_uuid();
    UPDATE public.virtual_staging_image_items SET
      status='processing',stage_state=CASE WHEN p_stage='redecorate' THEN 'redecorating' ELSE 'removing' END,
      stage_claim_token=v_token,stage_claimed_at=v_now,
      stage_lease_expires_at=v_now+pg_catalog.make_interval(secs=>p_lease_seconds),
      started_at=COALESCE(started_at,v_now)
    WHERE id=v_item.id RETURNING * INTO v_item;
  END IF;
  RETURN QUERY SELECT pg_catalog.to_jsonb(v_item)||pg_catalog.jsonb_build_object(
    'transformation_type',v_request.transformation_type,'decoration_style',v_request.decoration_style
  ),v_claimed,v_token;
END; $$;
CREATE OR REPLACE FUNCTION public.checkpoint_smart_space_free_space(
  p_user_id UUID,p_client_request_id UUID,p_item_index INTEGER,p_claim_token UUID,
  p_result JSONB,p_usage JSONB,p_output_size TEXT,p_estimated_cost_usd_micros BIGINT
)
RETURNS SETOF public.virtual_staging_image_items
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_item public.virtual_staging_image_items%ROWTYPE; v_request public.virtual_staging_image_requests%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Nao autorizado' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_request FROM public.virtual_staging_image_requests
   WHERE user_id=p_user_id AND client_request_id=p_client_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request nao encontrado'; END IF;
  SELECT * INTO v_item FROM public.virtual_staging_image_items
   WHERE request_id=v_request.id AND item_index=p_item_index FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'imagem economica nao encontrada'; END IF;
  IF v_item.stage_state='free_space_completed' THEN RETURN NEXT v_item; RETURN; END IF;
  IF v_item.stage_state<>'removing' OR v_item.stage_claim_token IS DISTINCT FROM p_claim_token THEN RAISE EXCEPTION 'claim da remocao invalido'; END IF;
  UPDATE public.virtual_staging_image_items SET stage_state='free_space_completed',result=p_result,
    stage1_usage=COALESCE(p_usage,'{}'::jsonb),provider_usage=COALESCE(p_usage,'{}'::jsonb),output_size=p_output_size,
    stage1_estimated_cost_usd_micros=p_estimated_cost_usd_micros,estimated_cost_usd_micros=p_estimated_cost_usd_micros,
    free_space_completed_at=pg_catalog.now(),stage_claim_token=NULL,stage_claimed_at=NULL,stage_lease_expires_at=NULL
   WHERE id=v_item.id RETURNING * INTO v_item;
  RETURN NEXT v_item;
END; $$;
CREATE OR REPLACE FUNCTION public.settle_smart_space_request(p_user_id UUID,p_client_request_id UUID)
RETURNS SETOF public.virtual_staging_image_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_request public.virtual_staging_image_requests%ROWTYPE; v_item public.virtual_staging_image_items%ROWTYPE;
  v_slice public.virtual_staging_image_item_allocations%ROWTYPE; v_lot public.credit_lots%ROWTYPE;
  v_completed INTEGER; v_failed INTEGER; v_target BIGINT; v_remaining BIGINT; v_consume BIGINT; v_release BIGINT;
  v_consumed BIGINT:=0; v_refunded BIGINT:=0; v_balance BIGINT;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Nao autorizado' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_request FROM public.virtual_staging_image_requests WHERE user_id=p_user_id AND client_request_id=p_client_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request nao encontrado'; END IF;
  IF v_request.status IN ('completed','failed') THEN RETURN NEXT v_request; RETURN; END IF;
  SELECT pg_catalog.count(*) FILTER(WHERE stage_state IN ('completed','partial')),
         pg_catalog.count(*) FILTER(WHERE stage_state='failed') INTO v_completed,v_failed
   FROM public.virtual_staging_image_items WHERE request_id=v_request.id;
  IF v_completed+v_failed<>v_request.image_count THEN RETURN NEXT v_request; RETURN; END IF;

  FOR v_item IN SELECT * FROM public.virtual_staging_image_items WHERE request_id=v_request.id ORDER BY item_index FOR UPDATE LOOP
    v_target:=CASE WHEN v_item.stage_state='completed' THEN v_item.unit_cost WHEN v_item.stage_state='partial' THEN 30 ELSE 0 END;
    v_remaining:=v_target;
    FOR v_slice IN SELECT * FROM public.virtual_staging_image_item_allocations WHERE item_id=v_item.id ORDER BY created_at,lot_id FOR UPDATE LOOP
      v_consume:=LEAST(v_slice.amount,v_remaining); v_release:=v_slice.amount-v_consume; v_remaining:=v_remaining-v_consume;
      IF v_release>0 THEN
        SELECT * INTO v_lot FROM public.credit_lots WHERE id=v_slice.lot_id FOR UPDATE;
        IF v_lot.status<>'revoked' AND (v_lot.expires_at IS NULL OR v_lot.expires_at>pg_catalog.now()) THEN
          IF v_lot.remaining_amount+v_release>v_lot.original_amount THEN RAISE EXCEPTION 'estorno excede lote original'; END IF;
          UPDATE public.credit_lots SET remaining_amount=remaining_amount+v_release,status='active' WHERE id=v_lot.id;
        END IF;
      END IF;
      UPDATE public.virtual_staging_image_item_allocations SET consumed_amount=v_consume,refunded_amount=v_release,
        status=CASE WHEN v_consume>0 THEN 'consumed' WHEN v_release>0 AND v_lot.status='revoked' THEN 'expired' ELSE 'refunded' END,
        settled_at=pg_catalog.now() WHERE item_id=v_slice.item_id AND lot_id=v_slice.lot_id;
    END LOOP;
    IF v_remaining<>0 THEN RAISE EXCEPTION 'alocacao insuficiente para settlement'; END IF;
    UPDATE public.virtual_staging_image_items SET smart_tokens_consumed=v_target WHERE id=v_item.id;
    v_consumed:=v_consumed+v_target; v_refunded:=v_refunded+(v_item.unit_cost-v_target);
  END LOOP;

  UPDATE public.credit_reservation_allocations cra SET
    consumed_amount=COALESCE((SELECT pg_catalog.sum(a.consumed_amount) FROM public.virtual_staging_image_item_allocations a
      JOIN public.virtual_staging_image_items i ON i.id=a.item_id WHERE i.request_id=v_request.id AND a.lot_id=cra.lot_id),0),
    refunded_amount=COALESCE((SELECT pg_catalog.sum(a.refunded_amount) FROM public.virtual_staging_image_item_allocations a
      JOIN public.virtual_staging_image_items i ON i.id=a.item_id WHERE i.request_id=v_request.id AND a.lot_id=cra.lot_id),0),
    status=CASE
      WHEN COALESCE((SELECT pg_catalog.sum(a.consumed_amount) FROM public.virtual_staging_image_item_allocations a
        JOIN public.virtual_staging_image_items i ON i.id=a.item_id WHERE i.request_id=v_request.id AND a.lot_id=cra.lot_id),0)>0 THEN 'consumed'
      WHEN COALESCE((SELECT pg_catalog.sum(a.refunded_amount) FROM public.virtual_staging_image_item_allocations a
        JOIN public.virtual_staging_image_items i ON i.id=a.item_id WHERE i.request_id=v_request.id AND a.lot_id=cra.lot_id),0)>0 THEN 'cancelled'
      ELSE cra.status END,
    consumed_at=CASE WHEN COALESCE((SELECT pg_catalog.sum(a.consumed_amount) FROM public.virtual_staging_image_item_allocations a
      JOIN public.virtual_staging_image_items i ON i.id=a.item_id WHERE i.request_id=v_request.id AND a.lot_id=cra.lot_id),0)>0 THEN pg_catalog.now() ELSE NULL END,
    cancelled_at=CASE WHEN COALESCE((SELECT pg_catalog.sum(a.refunded_amount) FROM public.virtual_staging_image_item_allocations a
      JOIN public.virtual_staging_image_items i ON i.id=a.item_id WHERE i.request_id=v_request.id AND a.lot_id=cra.lot_id),0)>0 THEN pg_catalog.now() ELSE NULL END
   WHERE cra.reservation_id=v_request.reservation_id;
  v_balance:=public.sync_credit_balance_cache_from_lots(p_user_id);
  IF v_consumed>0 THEN
    INSERT INTO public.credit_transactions(user_id,tipo,creditos,saldo_resultante,observacao,metadata)
    VALUES(p_user_id,'consumo',-v_consumed,v_balance,'Smart Space entregue',pg_catalog.jsonb_build_object(
      'product_code','virtual_staging','request_id',v_request.id,'completed_count',v_completed,'failed_count',v_failed));
  END IF;
  UPDATE public.credit_reservations SET status=CASE WHEN v_consumed>0 THEN 'consumed' ELSE 'cancelled' END,
    consumed_at=CASE WHEN v_consumed>0 THEN pg_catalog.now() ELSE NULL END,
    cancelled_at=CASE WHEN v_consumed=0 THEN pg_catalog.now() ELSE NULL END,
    metadata=metadata||pg_catalog.jsonb_build_object('partial_settlement',v_refunded>0,'smart_tokens_consumed',v_consumed,'smart_tokens_refunded',v_refunded)
   WHERE id=v_request.reservation_id;
  UPDATE public.virtual_staging_image_requests SET status=CASE WHEN v_completed>0 THEN 'completed' ELSE 'failed' END,
    completed_count=v_completed,failed_count=v_failed,smart_tokens_consumed=v_consumed,smart_tokens_refunded=v_refunded,
    completed_at=pg_catalog.now() WHERE id=v_request.id RETURNING * INTO v_request;
  INSERT INTO public.economic_generation_events(user_id,reservation_id,product_code,variant,provider,model,quantity,usage,catalog_version,status,idempotency_key,metadata)
  SELECT p_user_id,v_request.reservation_id,'virtual_staging','image','openai','gpt-image-2',1,i.provider_usage,v_request.catalog_version,
    CASE WHEN i.stage_state='failed' THEN 'refunded' ELSE 'delivered' END,'virtual_staging:image:'||i.id,
    pg_catalog.jsonb_build_object('request_id',v_request.id,'item_id',i.id,'quality',i.quality,'output_size',i.output_size,
      'delivery_status',i.stage_state,'estimated_cost_usd_micros',i.estimated_cost_usd_micros,
      'smart_tokens_reserved',i.unit_cost,'smart_tokens_consumed',i.smart_tokens_consumed,
      'smart_tokens_refunded',i.unit_cost-i.smart_tokens_consumed)
  FROM public.virtual_staging_image_items i WHERE i.request_id=v_request.id
  ON CONFLICT(idempotency_key) DO UPDATE SET status=EXCLUDED.status,usage=EXCLUDED.usage,metadata=EXCLUDED.metadata;
  RETURN NEXT v_request;
END; $$;
CREATE OR REPLACE FUNCTION public.finalize_smart_space_item(
  p_user_id UUID,p_client_request_id UUID,p_item_index INTEGER,p_stage TEXT,p_claim_token UUID,p_outcome TEXT,
  p_result JSONB DEFAULT '{}'::jsonb,p_usage JSONB DEFAULT '{}'::jsonb,p_output_size TEXT DEFAULT NULL,
  p_estimated_cost_usd_micros BIGINT DEFAULT NULL,p_failure_reason TEXT DEFAULT NULL
)
RETURNS SETOF public.virtual_staging_image_items LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_item public.virtual_staging_image_items%ROWTYPE; v_request public.virtual_staging_image_requests%ROWTYPE; v_state TEXT;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Nao autorizado' USING ERRCODE='42501'; END IF;
  IF p_outcome NOT IN ('completed','partial','failed') THEN RAISE EXCEPTION 'resultado terminal invalido'; END IF;
  SELECT r.* INTO v_request FROM public.virtual_staging_image_requests r WHERE r.user_id=p_user_id AND r.client_request_id=p_client_request_id FOR UPDATE;
  SELECT * INTO v_item FROM public.virtual_staging_image_items WHERE request_id=v_request.id AND item_index=p_item_index FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'imagem economica nao encontrada'; END IF;
  IF v_item.stage_state IN ('completed','partial','failed') THEN RETURN NEXT v_item; RETURN; END IF;
  IF v_item.stage_claim_token IS DISTINCT FROM p_claim_token THEN RAISE EXCEPTION 'claim de etapa invalido'; END IF;
  IF p_stage='single' AND v_request.transformation_type<>'remove_and_redecorate' AND v_item.stage_state='removing' THEN
    v_state:=CASE WHEN p_outcome='completed' THEN 'completed' ELSE 'failed' END;
  ELSIF p_stage='remove' AND v_request.transformation_type='remove_and_redecorate' AND v_item.stage_state='removing' AND p_outcome='failed' THEN
    v_state:='failed';
  ELSIF p_stage='redecorate' AND v_request.transformation_type='remove_and_redecorate' AND v_item.stage_state='redecorating' AND p_outcome IN ('completed','partial') THEN
    v_state:=p_outcome;
  ELSE RAISE EXCEPTION 'transicao de etapa invalida'; END IF;
  UPDATE public.virtual_staging_image_items SET status=CASE WHEN v_state='failed' THEN 'failed' ELSE 'completed' END,
    stage_state=v_state,
    result=CASE WHEN v_state='partial' AND COALESCE(p_result,'{}'::jsonb)='{}'::jsonb THEN result ELSE COALESCE(p_result,result) END,
    provider_usage=CASE
      WHEN v_state='partial' AND COALESCE(p_usage,'{}'::jsonb)='{}'::jsonb THEN provider_usage
      WHEN p_stage='redecorate' THEN stage1_usage||COALESCE(p_usage,'{}'::jsonb)
      ELSE COALESCE(p_usage,'{}'::jsonb)
    END,
    stage1_usage=CASE WHEN p_stage IN ('single','remove') THEN COALESCE(p_usage,'{}'::jsonb) ELSE stage1_usage END,
    stage2_usage=CASE WHEN p_stage='redecorate' THEN COALESCE(p_usage,'{}'::jsonb) ELSE stage2_usage END,
    output_size=p_output_size,estimated_cost_usd_micros=CASE WHEN p_stage='redecorate' THEN COALESCE(stage1_estimated_cost_usd_micros,0)+COALESCE(p_estimated_cost_usd_micros,0) ELSE p_estimated_cost_usd_micros END,
    stage2_estimated_cost_usd_micros=CASE WHEN p_stage='redecorate' THEN p_estimated_cost_usd_micros ELSE stage2_estimated_cost_usd_micros END,
    failure_reason=p_failure_reason,stage_claim_token=NULL,stage_claimed_at=NULL,stage_lease_expires_at=NULL,
    completed_at=CASE WHEN v_state IN ('completed','partial') THEN pg_catalog.now() ELSE NULL END,
    failed_at=CASE WHEN v_state='failed' THEN pg_catalog.now() ELSE NULL END
   WHERE id=v_item.id RETURNING * INTO v_item;
  PERFORM public.settle_smart_space_request(p_user_id,p_client_request_id);
  RETURN NEXT v_item;
END; $$;
CREATE OR REPLACE FUNCTION public.checkpoint_smart_space_redecoration_output(
  p_user_id UUID,p_client_request_id UUID,p_item_index INTEGER,p_claim_token UUID,
  p_result JSONB,p_usage JSONB,p_output_size TEXT,p_estimated_cost_usd_micros BIGINT
)
RETURNS SETOF public.virtual_staging_image_items LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_item public.virtual_staging_image_items%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Nao autorizado' USING ERRCODE='42501'; END IF;
  SELECT i.* INTO v_item FROM public.virtual_staging_image_items i JOIN public.virtual_staging_image_requests r ON r.id=i.request_id
   WHERE r.user_id=p_user_id AND r.client_request_id=p_client_request_id AND i.item_index=p_item_index FOR UPDATE OF i;
  IF NOT FOUND THEN RAISE EXCEPTION 'imagem economica nao encontrada'; END IF;
  IF v_item.stage_state IN ('completed','partial') THEN RETURN NEXT v_item; RETURN; END IF;
  IF v_item.stage_state<>'redecorating' OR v_item.stage_claim_token IS DISTINCT FROM p_claim_token THEN
    RAISE EXCEPTION 'claim da decoracao invalido';
  END IF;
  IF COALESCE(p_result->>'delivery_status','')<>'completed' OR COALESCE(p_result->>'final_output_path','')='' THEN
    RAISE EXCEPTION 'resultado final invalido';
  END IF;
  UPDATE public.virtual_staging_image_items SET result=p_result,stage2_usage=COALESCE(p_usage,'{}'::jsonb),
    provider_usage=stage1_usage||COALESCE(p_usage,'{}'::jsonb),output_size=p_output_size,
    stage2_estimated_cost_usd_micros=p_estimated_cost_usd_micros,
    estimated_cost_usd_micros=COALESCE(stage1_estimated_cost_usd_micros,0)+COALESCE(p_estimated_cost_usd_micros,0)
   WHERE id=v_item.id RETURNING * INTO v_item;
  RETURN NEXT v_item;
END; $$;
CREATE OR REPLACE FUNCTION public.reconcile_smart_space_redecoration_output(
  p_user_id UUID,p_client_request_id UUID,p_item_index INTEGER
)
RETURNS SETOF public.virtual_staging_image_items LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_item public.virtual_staging_image_items%ROWTYPE; v_request public.virtual_staging_image_requests%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Nao autorizado' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_request FROM public.virtual_staging_image_requests
   WHERE user_id=p_user_id AND client_request_id=p_client_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request nao encontrado'; END IF;
  SELECT * INTO v_item FROM public.virtual_staging_image_items
   WHERE request_id=v_request.id AND item_index=p_item_index FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'imagem economica nao encontrada'; END IF;
  IF v_item.stage_state IN ('completed','partial') THEN RETURN NEXT v_item; RETURN; END IF;
  IF v_item.stage_state<>'redecorating' OR v_item.stage_claim_token IS NULL
    OR COALESCE(v_item.result->>'delivery_status','')<>'completed'
    OR COALESCE(v_item.result->>'final_output_path','')='' THEN
    RAISE EXCEPTION 'resultado final nao reconciliavel';
  END IF;
  RETURN QUERY SELECT * FROM public.finalize_smart_space_item(
    p_user_id,p_client_request_id,p_item_index,'redecorate',v_item.stage_claim_token,'completed',
    v_item.result,v_item.stage2_usage,v_item.output_size,v_item.stage2_estimated_cost_usd_micros,NULL
  );
END; $$;
CREATE OR REPLACE FUNCTION public.fail_smart_space_item_before_provider(
  p_user_id UUID,p_client_request_id UUID,p_item_index INTEGER,p_failure_reason TEXT
)
RETURNS SETOF public.virtual_staging_image_items LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_item public.virtual_staging_image_items%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Nao autorizado' USING ERRCODE='42501'; END IF;
  SELECT i.* INTO v_item FROM public.virtual_staging_image_items i JOIN public.virtual_staging_image_requests r ON r.id=i.request_id
   WHERE r.user_id=p_user_id AND r.client_request_id=p_client_request_id AND i.item_index=p_item_index FOR UPDATE OF i;
  IF NOT FOUND THEN RAISE EXCEPTION 'imagem economica nao encontrada'; END IF;
  IF v_item.stage_state IN ('completed','partial','failed') THEN RETURN NEXT v_item; RETURN; END IF;
  IF v_item.stage_state<>'awaiting_processing' THEN RAISE EXCEPTION 'item ja iniciou provider'; END IF;
  UPDATE public.virtual_staging_image_items SET status='failed',stage_state='failed',failure_reason=pg_catalog.left(p_failure_reason,120),
    failed_at=pg_catalog.now() WHERE id=v_item.id RETURNING * INTO v_item;
  PERFORM public.settle_smart_space_request(p_user_id,p_client_request_id);
  RETURN NEXT v_item;
END; $$;
CREATE OR REPLACE FUNCTION public.claim_smart_space_video_render(
  p_user_id UUID,p_client_request_id UUID,p_item_index INTEGER,p_idempotency_key TEXT
)
RETURNS TABLE(returned_item JSONB,claimed BOOLEAN,claim_token UUID)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_item public.virtual_staging_image_items%ROWTYPE; v_token UUID:=NULL; v_claimed BOOLEAN:=FALSE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Nao autorizado' USING ERRCODE='42501'; END IF;
  IF p_idempotency_key IS NULL OR pg_catalog.length(p_idempotency_key)>160 THEN RAISE EXCEPTION 'chave de video invalida'; END IF;
  SELECT i.* INTO v_item FROM public.virtual_staging_image_items i
  JOIN public.virtual_staging_image_requests r ON r.id=i.request_id
  WHERE r.user_id=p_user_id AND r.client_request_id=p_client_request_id AND i.item_index=p_item_index
  FOR UPDATE OF i;
  IF NOT FOUND THEN RAISE EXCEPTION 'imagem economica nao encontrada'; END IF;
  IF v_item.stage_state<>'completed' OR COALESCE(v_item.result->>'delivery_status','')<>'completed' THEN
    RAISE EXCEPTION 'imagem final ainda nao concluida';
  END IF;
  IF v_item.video_idempotency_key IS NOT NULL AND v_item.video_idempotency_key<>p_idempotency_key THEN
    RAISE EXCEPTION 'video existente diverge do resultado';
  END IF;
  IF v_item.video_state IN ('not_requested','failed_retryable') THEN
    v_token:=pg_catalog.gen_random_uuid(); v_claimed:=TRUE;
    UPDATE public.virtual_staging_image_items SET
      video_state='submitting',video_renderer='creatomate-renderscript',video_idempotency_key=p_idempotency_key,
      video_claim_token=v_token,video_claimed_at=pg_catalog.now(),video_started_at=COALESCE(video_started_at,pg_catalog.now()),
      video_failure_reason=NULL,video_failed_at=NULL
    WHERE id=v_item.id RETURNING * INTO v_item;
  END IF;
  RETURN QUERY SELECT pg_catalog.to_jsonb(v_item),v_claimed,v_token;
END; $$;
CREATE OR REPLACE FUNCTION public.register_smart_space_video_render(
  p_user_id UUID,p_client_request_id UUID,p_item_index INTEGER,p_claim_token UUID,p_render_id TEXT
)
RETURNS SETOF public.virtual_staging_image_items
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_item public.virtual_staging_image_items%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Nao autorizado' USING ERRCODE='42501'; END IF;
  IF p_render_id IS NULL OR pg_catalog.length(p_render_id)>160 THEN RAISE EXCEPTION 'render id invalido'; END IF;
  SELECT i.* INTO v_item FROM public.virtual_staging_image_items i JOIN public.virtual_staging_image_requests r ON r.id=i.request_id
  WHERE r.user_id=p_user_id AND r.client_request_id=p_client_request_id AND i.item_index=p_item_index FOR UPDATE OF i;
  IF v_item.video_state='completed' THEN RETURN NEXT v_item; RETURN; END IF;
  IF v_item.video_state<>'submitting' OR v_item.video_claim_token IS DISTINCT FROM p_claim_token THEN RAISE EXCEPTION 'claim de video invalido'; END IF;
  UPDATE public.virtual_staging_image_items SET video_state='rendering',video_render_id=p_render_id
  WHERE id=v_item.id RETURNING * INTO v_item;
  RETURN NEXT v_item;
END; $$;
CREATE OR REPLACE FUNCTION public.complete_smart_space_video_render(
  p_user_id UUID,p_client_request_id UUID,p_item_index INTEGER,p_claim_token UUID,p_output_path TEXT
)
RETURNS SETOF public.virtual_staging_image_items
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_item public.virtual_staging_image_items%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Nao autorizado' USING ERRCODE='42501'; END IF;
  IF p_output_path IS NULL OR pg_catalog.length(p_output_path)>500 THEN RAISE EXCEPTION 'caminho de video invalido'; END IF;
  SELECT i.* INTO v_item FROM public.virtual_staging_image_items i JOIN public.virtual_staging_image_requests r ON r.id=i.request_id
  WHERE r.user_id=p_user_id AND r.client_request_id=p_client_request_id AND i.item_index=p_item_index FOR UPDATE OF i;
  IF v_item.video_state='completed' THEN RETURN NEXT v_item; RETURN; END IF;
  IF v_item.video_state<>'rendering' OR v_item.video_claim_token IS DISTINCT FROM p_claim_token THEN RAISE EXCEPTION 'claim de video invalido'; END IF;
  UPDATE public.virtual_staging_image_items SET video_state='completed',video_output_path=p_output_path,
    video_failure_reason=NULL,video_claim_token=NULL,video_completed_at=pg_catalog.now(),video_failed_at=NULL
  WHERE id=v_item.id RETURNING * INTO v_item;
  RETURN NEXT v_item;
END; $$;
CREATE OR REPLACE FUNCTION public.fail_smart_space_video_render(
  p_user_id UUID,p_client_request_id UUID,p_item_index INTEGER,p_claim_token UUID,p_reason TEXT,p_retryable BOOLEAN DEFAULT FALSE
)
RETURNS SETOF public.virtual_staging_image_items
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_item public.virtual_staging_image_items%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Nao autorizado' USING ERRCODE='42501'; END IF;
  SELECT i.* INTO v_item FROM public.virtual_staging_image_items i JOIN public.virtual_staging_image_requests r ON r.id=i.request_id
  WHERE r.user_id=p_user_id AND r.client_request_id=p_client_request_id AND i.item_index=p_item_index FOR UPDATE OF i;
  IF v_item.video_state='completed' THEN RETURN NEXT v_item; RETURN; END IF;
  IF v_item.video_state NOT IN ('submitting','rendering') OR v_item.video_claim_token IS DISTINCT FROM p_claim_token THEN RAISE EXCEPTION 'claim de video invalido'; END IF;
  UPDATE public.virtual_staging_image_items SET video_state=CASE WHEN p_retryable THEN 'failed_retryable' ELSE 'failed_unknown' END,
    video_failure_reason=pg_catalog.left(COALESCE(p_reason,'video_render_failed'),120),video_claim_token=NULL,video_failed_at=pg_catalog.now()
  WHERE id=v_item.id RETURNING * INTO v_item;
  RETURN NEXT v_item;
END; $$;
REVOKE EXECUTE ON FUNCTION public.prepare_smart_space_request(UUID,UUID,INTEGER,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_smart_space_stage(UUID,UUID,INTEGER,TEXT,INTEGER) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.checkpoint_smart_space_free_space(UUID,UUID,INTEGER,UUID,JSONB,JSONB,TEXT,BIGINT) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.finalize_smart_space_item(UUID,UUID,INTEGER,TEXT,UUID,TEXT,JSONB,JSONB,TEXT,BIGINT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.checkpoint_smart_space_redecoration_output(UUID,UUID,INTEGER,UUID,JSONB,JSONB,TEXT,BIGINT) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.reconcile_smart_space_redecoration_output(UUID,UUID,INTEGER) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.settle_smart_space_request(UUID,UUID) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.fail_smart_space_item_before_provider(UUID,UUID,INTEGER,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_smart_space_video_render(UUID,UUID,INTEGER,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.register_smart_space_video_render(UUID,UUID,INTEGER,UUID,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_smart_space_video_render(UUID,UUID,INTEGER,UUID,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.fail_smart_space_video_render(UUID,UUID,INTEGER,UUID,TEXT,BOOLEAN) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_smart_space_request(UUID,UUID,INTEGER,TEXT,TEXT,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_smart_space_stage(UUID,UUID,INTEGER,TEXT,INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.checkpoint_smart_space_free_space(UUID,UUID,INTEGER,UUID,JSONB,JSONB,TEXT,BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_smart_space_item(UUID,UUID,INTEGER,TEXT,UUID,TEXT,JSONB,JSONB,TEXT,BIGINT,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.checkpoint_smart_space_redecoration_output(UUID,UUID,INTEGER,UUID,JSONB,JSONB,TEXT,BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_smart_space_redecoration_output(UUID,UUID,INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_smart_space_request(UUID,UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_smart_space_item_before_provider(UUID,UUID,INTEGER,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_smart_space_video_render(UUID,UUID,INTEGER,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.register_smart_space_video_render(UUID,UUID,INTEGER,UUID,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_smart_space_video_render(UUID,UUID,INTEGER,UUID,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_smart_space_video_render(UUID,UUID,INTEGER,UUID,TEXT,BOOLEAN) TO service_role;
