-- One controlled Virtual Staging trial for confirmed trial accounts.
-- This is deliberately scoped to the existing private, authenticated image flow:
-- one `furnish` image only. Paid and courtesy accounts retain the normal catalog.

CREATE TABLE public.virtual_staging_trial_uses (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id UUID NOT NULL UNIQUE REFERENCES public.virtual_staging_image_requests(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

ALTER TABLE public.virtual_staging_trial_uses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.virtual_staging_trial_uses FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.virtual_staging_trial_uses FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.virtual_staging_trial_uses TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_credits_from_lots(
  p_user_id UUID, p_amount BIGINT, p_idempotency_key TEXT, p_campaign_id UUID DEFAULT NULL,
  p_reason TEXT DEFAULT NULL, p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS SETOF public.credit_reservations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_existing public.credit_reservations%ROWTYPE; v_profile public.profiles%ROWTYPE;
  v_available BIGINT; v_missing BIGINT; v_take BIGINT; v_lot public.credit_lots%ROWTYPE;
  v_paid_account BOOLEAN; v_courtesy_active BOOLEAN; v_full_catalog_access BOOLEAN; v_trial_allowed BOOLEAN;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Nao autorizado a operar creditos por lotes' USING ERRCODE = '42501'; END IF;
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'user_id obrigatorio'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'amount deve ser maior que zero'; END IF;
  IF p_idempotency_key IS NULL OR pg_catalog.length(pg_catalog.btrim(p_idempotency_key)) = 0 THEN RAISE EXCEPTION 'idempotency_key obrigatoria'; END IF;
  IF p_metadata IS NULL OR pg_catalog.jsonb_typeof(p_metadata) <> 'object' THEN RAISE EXCEPTION 'metadata deve ser objeto JSON'; END IF;

  SELECT * INTO v_existing FROM public.credit_reservations cr WHERE cr.user_id=p_user_id AND cr.idempotency_key=p_idempotency_key FOR UPDATE;
  IF FOUND THEN RETURN NEXT v_existing; RETURN; END IF;
  SELECT * INTO v_profile FROM public.profiles p WHERE p.id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile nao encontrado para user_id %', p_user_id; END IF;
  SELECT * INTO v_existing FROM public.credit_reservations cr WHERE cr.user_id=p_user_id AND cr.idempotency_key=p_idempotency_key FOR UPDATE;
  IF FOUND THEN RETURN NEXT v_existing; RETURN; END IF;
  PERFORM public.expire_credit_lots_for_user(p_user_id);

  SELECT EXISTS (SELECT 1 FROM public.credit_lots cl WHERE cl.user_id=p_user_id AND ((cl.source='subscription' AND cl.stripe_invoice_id IS NOT NULL) OR (cl.source='purchase' AND cl.stripe_checkout_session_id IS NOT NULL))) INTO v_paid_account;
  SELECT COALESCE((SELECT ace.action='granted' FROM public.admin_catalog_access_events ace WHERE ace.user_id=p_user_id ORDER BY ace.created_at DESC,ace.id DESC LIMIT 1),FALSE) INTO v_courtesy_active;
  v_full_catalog_access:=v_paid_account OR v_courtesy_active;

  v_trial_allowed :=
    (p_amount=25 AND p_metadata->>'product_code'='text_campaign' AND p_metadata->>'variant'='standard' AND p_metadata->>'smart_token_cost'='25')
    OR (p_metadata->>'product_code'='quick_banners' AND p_metadata->>'variant'='item' AND p_metadata->>'unit_cost'='45' AND p_metadata->>'item_count'~'^[1-5]$' AND p_amount=(p_metadata->>'item_count')::BIGINT AND p_metadata->>'smart_token_cost'=p_amount::TEXT)
    OR (p_amount=100 AND p_metadata->>'product_code'='smart_carousel' AND p_metadata->>'image_count'~'^(?:[5-9]|1[0-9]|20)$' AND pg_catalog.length(pg_catalog.btrim(p_metadata->>'catalog_version'))>0)
    OR (p_amount=30 AND p_metadata->>'product_code'='virtual_staging' AND p_metadata->>'variant'='image' AND p_metadata->>'image_count'='1' AND p_metadata->>'unit_cost'='30' AND p_metadata->>'transformation_type'='furnish' AND p_metadata->>'decoration_style' IN ('cozy','contemporary') AND p_metadata->>'landing_virtual_staging_trial'='true' AND pg_catalog.length(pg_catalog.btrim(p_metadata->>'catalog_version'))>0);
  IF NOT v_full_catalog_access AND NOT v_trial_allowed THEN RAISE EXCEPTION 'TRIAL_PRODUCT_NOT_ALLOWED'; END IF;

  SELECT COALESCE(pg_catalog.sum(cl.remaining_amount),0)::BIGINT INTO v_available FROM public.credit_lots cl
    WHERE cl.user_id=p_user_id AND cl.status='active' AND cl.remaining_amount>0 AND (cl.expires_at IS NULL OR cl.expires_at>pg_catalog.now())
      AND (cl.hidden_from_ui=FALSE OR (cl.source='trial' AND (v_full_catalog_access OR v_trial_allowed)));
  IF v_available<p_amount THEN RAISE EXCEPTION 'Creditos insuficientes para esta geracao.'; END IF;

  INSERT INTO public.credit_reservations(user_id,campaign_id,idempotency_key,amount,status,reason,metadata)
  VALUES(p_user_id,p_campaign_id,p_idempotency_key,p_amount,'reserved',p_reason,COALESCE(p_metadata,'{}'::jsonb)||pg_catalog.jsonb_build_object('lot_engine',true,'fefo',true)) RETURNING * INTO v_existing;
  v_missing:=p_amount;
  FOR v_lot IN SELECT * FROM public.credit_lots cl WHERE cl.user_id=p_user_id AND cl.status='active' AND cl.remaining_amount>0 AND (cl.expires_at IS NULL OR cl.expires_at>pg_catalog.now())
      AND (cl.hidden_from_ui=FALSE OR (cl.source='trial' AND (v_full_catalog_access OR v_trial_allowed))) ORDER BY cl.expires_at ASC NULLS LAST,cl.created_at ASC,cl.id ASC FOR UPDATE LOOP
    EXIT WHEN v_missing=0;
    v_take:=LEAST(v_lot.remaining_amount,v_missing);
    UPDATE public.credit_lots cl SET remaining_amount=cl.remaining_amount-v_take,status=CASE WHEN cl.remaining_amount-v_take=0 THEN 'exhausted' ELSE 'active' END WHERE cl.id=v_lot.id;
    INSERT INTO public.credit_reservation_allocations(reservation_id,lot_id,amount,status) VALUES(v_existing.id,v_lot.id,v_take,'reserved');
    v_missing:=v_missing-v_take;
  END LOOP;
  IF v_missing<>0 THEN RAISE EXCEPTION 'Falha interna ao alocar creditos por lote.'; END IF;
  PERFORM public.sync_credit_balance_cache_from_lots(p_user_id);
  RETURN NEXT v_existing;
END;
$$;

-- The public route is an intent only. The authenticated Edge Function passes this
-- explicit flag to the economy RPC, so a normal Virtual Staging request cannot
-- accidentally consume the Landing offer.
CREATE OR REPLACE FUNCTION public.prepare_smart_space_request(
  p_user_id UUID,p_client_request_id UUID,p_image_count INTEGER,p_transformation_type TEXT,
  p_decoration_style TEXT,p_catalog_version TEXT,p_landing_trial BOOLEAN
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
  IF p_landing_trial AND (p_image_count<>1 OR p_transformation_type<>'furnish' OR p_decoration_style NOT IN ('cozy','contemporary')) THEN
    RAISE EXCEPTION 'TRIAL_PRODUCT_NOT_ALLOWED';
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
      'unit_cost',v_unit_cost,'transformation_type',p_transformation_type,'decoration_style',p_decoration_style,
      'landing_virtual_staging_trial',p_landing_trial,'catalog_version',p_catalog_version)
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

CREATE OR REPLACE FUNCTION public.prepare_smart_space_request(
  p_user_id UUID,p_client_request_id UUID,p_image_count INTEGER,p_transformation_type TEXT,
  p_decoration_style TEXT,p_catalog_version TEXT
)
RETURNS SETOF public.virtual_staging_image_requests
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  SELECT * FROM public.prepare_smart_space_request($1,$2,$3,$4,$5,$6,FALSE);
$$;

CREATE OR REPLACE FUNCTION public.claim_virtual_staging_trial_use()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_trial_funded BOOLEAN; v_landing_trial BOOLEAN; v_claimed UUID;
BEGIN
  IF NEW.status <> 'processing' OR OLD.reservation_id IS NOT NULL OR NEW.reservation_id IS NULL THEN RETURN NEW; END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.credit_reservation_allocations allocation
    JOIN public.credit_lots lot ON lot.id=allocation.lot_id
    WHERE allocation.reservation_id=NEW.reservation_id AND lot.source='trial'
  ) INTO v_trial_funded;
  IF NOT v_trial_funded THEN RETURN NEW; END IF;
  SELECT COALESCE((reservation.metadata->>'landing_virtual_staging_trial')='true',FALSE)
    INTO v_landing_trial FROM public.credit_reservations reservation WHERE reservation.id=NEW.reservation_id;
  IF NOT v_landing_trial THEN RAISE EXCEPTION 'TRIAL_PRODUCT_NOT_ALLOWED'; END IF;
  IF NEW.image_count<>1 OR NEW.unit_cost<>30 OR NEW.transformation_type<>'furnish' OR NEW.decoration_style NOT IN ('cozy','contemporary') THEN
    RAISE EXCEPTION 'TRIAL_PRODUCT_NOT_ALLOWED';
  END IF;
  INSERT INTO public.virtual_staging_trial_uses(user_id,request_id) VALUES(NEW.user_id,NEW.id)
  ON CONFLICT(user_id) DO NOTHING RETURNING user_id INTO v_claimed;
  IF v_claimed IS NULL THEN RAISE EXCEPTION 'VIRTUAL_STAGING_TRIAL_ALREADY_USED'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS claim_virtual_staging_trial_use_on_prepare ON public.virtual_staging_image_requests;
CREATE TRIGGER claim_virtual_staging_trial_use_on_prepare
  BEFORE UPDATE OF reservation_id,status ON public.virtual_staging_image_requests
  FOR EACH ROW EXECUTE FUNCTION public.claim_virtual_staging_trial_use();

REVOKE ALL ON FUNCTION public.claim_virtual_staging_trial_use() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reserve_credits_from_lots(UUID,BIGINT,TEXT,UUID,TEXT,JSONB) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_credits_from_lots(UUID,BIGINT,TEXT,UUID,TEXT,JSONB) TO service_role;
REVOKE EXECUTE ON FUNCTION public.prepare_smart_space_request(UUID,UUID,INTEGER,TEXT,TEXT,TEXT,BOOLEAN) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.prepare_smart_space_request(UUID,UUID,INTEGER,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_smart_space_request(UUID,UUID,INTEGER,TEXT,TEXT,TEXT,BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.prepare_smart_space_request(UUID,UUID,INTEGER,TEXT,TEXT,TEXT) TO service_role;
