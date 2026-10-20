-- One free-account economy. A confirmed account receives its existing one-time
-- 400 ST trial lot and may spend it through any active product at its normal
-- server-owned price. The lot remains private/account-bound; only product
-- allowlists and the Virtual Staging special-case are removed.

CREATE OR REPLACE FUNCTION public.reserve_credits_from_lots(
  p_user_id UUID,
  p_amount BIGINT,
  p_idempotency_key TEXT,
  p_campaign_id UUID DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS SETOF public.credit_reservations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_existing public.credit_reservations%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_available BIGINT;
  v_missing BIGINT;
  v_take BIGINT;
  v_lot public.credit_lots%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Nao autorizado a operar creditos por lotes' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'user_id obrigatorio'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'amount deve ser maior que zero'; END IF;
  IF p_idempotency_key IS NULL OR pg_catalog.length(pg_catalog.btrim(p_idempotency_key)) = 0 THEN
    RAISE EXCEPTION 'idempotency_key obrigatoria';
  END IF;
  IF p_metadata IS NULL OR pg_catalog.jsonb_typeof(p_metadata) <> 'object' THEN
    RAISE EXCEPTION 'metadata deve ser objeto JSON';
  END IF;

  SELECT * INTO v_existing
    FROM public.credit_reservations cr
   WHERE cr.user_id = p_user_id AND cr.idempotency_key = p_idempotency_key
   FOR UPDATE;
  IF FOUND THEN RETURN NEXT v_existing; RETURN; END IF;

  SELECT * INTO v_profile FROM public.profiles p WHERE p.id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile nao encontrado para user_id %', p_user_id; END IF;

  -- Recheck after the profile lock to preserve idempotency under concurrency.
  SELECT * INTO v_existing
    FROM public.credit_reservations cr
   WHERE cr.user_id = p_user_id AND cr.idempotency_key = p_idempotency_key
   FOR UPDATE;
  IF FOUND THEN RETURN NEXT v_existing; RETURN; END IF;

  PERFORM public.expire_credit_lots_for_user(p_user_id);

  SELECT COALESCE(pg_catalog.sum(cl.remaining_amount), 0)::BIGINT
    INTO v_available
    FROM public.credit_lots cl
   WHERE cl.user_id = p_user_id
     AND cl.status = 'active'
     AND cl.remaining_amount > 0
     AND (cl.expires_at IS NULL OR cl.expires_at > pg_catalog.now())
     AND (cl.hidden_from_ui = FALSE OR cl.source = 'trial');

  IF v_available < p_amount THEN
    RAISE EXCEPTION 'Creditos insuficientes para esta geracao.';
  END IF;

  INSERT INTO public.credit_reservations (
    user_id, campaign_id, idempotency_key, amount, status, reason, metadata
  ) VALUES (
    p_user_id, p_campaign_id, p_idempotency_key, p_amount, 'reserved', p_reason,
    COALESCE(p_metadata, '{}'::jsonb) || pg_catalog.jsonb_build_object('lot_engine', true, 'fefo', true)
  ) RETURNING * INTO v_existing;

  v_missing := p_amount;
  FOR v_lot IN
    SELECT *
      FROM public.credit_lots cl
     WHERE cl.user_id = p_user_id
       AND cl.status = 'active'
       AND cl.remaining_amount > 0
       AND (cl.expires_at IS NULL OR cl.expires_at > pg_catalog.now())
       AND (cl.hidden_from_ui = FALSE OR cl.source = 'trial')
     ORDER BY cl.expires_at ASC NULLS LAST, cl.created_at ASC, cl.id ASC
     FOR UPDATE
  LOOP
    EXIT WHEN v_missing = 0;
    v_take := LEAST(v_lot.remaining_amount, v_missing);
    UPDATE public.credit_lots cl
       SET remaining_amount = cl.remaining_amount - v_take,
           status = CASE WHEN cl.remaining_amount - v_take = 0 THEN 'exhausted' ELSE 'active' END
     WHERE cl.id = v_lot.id;
    INSERT INTO public.credit_reservation_allocations(reservation_id, lot_id, amount, status)
    VALUES (v_existing.id, v_lot.id, v_take, 'reserved');
    v_missing := v_missing - v_take;
  END LOOP;

  IF v_missing <> 0 THEN RAISE EXCEPTION 'Falha interna ao alocar creditos por lote.'; END IF;
  PERFORM public.sync_credit_balance_cache_from_lots(p_user_id);
  RETURN NEXT v_existing;
END;
$$;

-- Restore the normal Virtual Staging contract: 1-5 images, all canonical
-- transformations and styles. The boolean signature is retained only for
-- in-flight callers and intentionally has no economic effect.
CREATE OR REPLACE FUNCTION public.prepare_smart_space_request(
  p_user_id UUID,
  p_client_request_id UUID,
  p_image_count INTEGER,
  p_transformation_type TEXT,
  p_decoration_style TEXT,
  p_catalog_version TEXT
)
RETURNS SETOF public.virtual_staging_image_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request public.virtual_staging_image_requests%ROWTYPE;
  v_reservation public.credit_reservations%ROWTYPE;
  v_item public.virtual_staging_image_items%ROWTYPE;
  v_allocation RECORD;
  v_missing BIGINT;
  v_take BIGINT;
  v_index INTEGER;
  v_unit_cost BIGINT;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Nao autorizado' USING ERRCODE = '42501'; END IF;
  IF p_image_count NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'quantidade de imagens invalida'; END IF;
  IF p_transformation_type NOT IN ('furnish','remove_furniture','remove_and_redecorate','clear_area') THEN RAISE EXCEPTION 'transformacao invalida'; END IF;
  IF (p_transformation_type IN ('furnish','remove_and_redecorate') AND (p_decoration_style IS NULL OR p_decoration_style NOT IN ('cozy','contemporary')))
    OR (p_transformation_type IN ('remove_furniture','clear_area') AND p_decoration_style IS NOT NULL) THEN
    RAISE EXCEPTION 'estilo invalido para transformacao';
  END IF;
  v_unit_cost := CASE WHEN p_transformation_type = 'remove_and_redecorate' THEN 60 ELSE 30 END;

  INSERT INTO public.virtual_staging_image_requests(
    user_id,client_request_id,image_count,unit_cost,smart_tokens_quoted,catalog_version,transformation_type,decoration_style
  ) VALUES(
    p_user_id,p_client_request_id,p_image_count,v_unit_cost,p_image_count*v_unit_cost,p_catalog_version,p_transformation_type,p_decoration_style
  ) ON CONFLICT(user_id,client_request_id) DO NOTHING;
  SELECT * INTO v_request FROM public.virtual_staging_image_requests
   WHERE user_id=p_user_id AND client_request_id=p_client_request_id FOR UPDATE;
  IF v_request.image_count<>p_image_count OR v_request.unit_cost<>v_unit_cost
    OR v_request.smart_tokens_quoted<>p_image_count*v_unit_cost OR v_request.catalog_version<>p_catalog_version
    OR v_request.transformation_type<>p_transformation_type OR v_request.decoration_style IS DISTINCT FROM p_decoration_style THEN
    RAISE EXCEPTION 'request existente diverge da cotacao';
  END IF;
  IF v_request.reservation_id IS NOT NULL THEN RETURN NEXT v_request; RETURN; END IF;

  SELECT * INTO v_reservation FROM public.reserve_credits_from_lots(
    p_user_id,p_image_count*v_unit_cost,'virtual_staging:'||p_client_request_id,NULL,'Snetia Space',
    pg_catalog.jsonb_build_object('product_code','virtual_staging','variant','image','image_count',p_image_count,
      'unit_cost',v_unit_cost,'transformation_type',p_transformation_type,'decoration_style',p_decoration_style,
      'catalog_version',p_catalog_version)
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
END;
$$;

CREATE OR REPLACE FUNCTION public.prepare_smart_space_request(
  p_user_id UUID,
  p_client_request_id UUID,
  p_image_count INTEGER,
  p_transformation_type TEXT,
  p_decoration_style TEXT,
  p_catalog_version TEXT,
  p_landing_trial BOOLEAN
)
RETURNS SETOF public.virtual_staging_image_requests
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT * FROM public.prepare_smart_space_request($1,$2,$3,$4,$5,$6);
$$;

-- Preserve historical trial-use data, but do not apply that retired eligibility
-- rule to new normal Virtual Staging requests.
DROP TRIGGER IF EXISTS claim_virtual_staging_trial_use_on_prepare ON public.virtual_staging_image_requests;

-- Future confirmed accounts receive the final free-account balance. Existing
-- historical trial lots are intentionally untouched; the one-time trigger and
-- partial unique index remain the anti-replay boundary for each account.
CREATE OR REPLACE FUNCTION public.grant_confirmed_email_trial()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.email_confirmed_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.credit_lots (
    user_id, source, original_amount, remaining_amount, expires_at, status,
    idempotency_key, catalog_version, hidden_from_ui, metadata
  ) VALUES (
    NEW.id, 'trial', 400, 400, NULL, 'active',
    'trial:signup-all-products:v3', 'trial-2026-10-all-products-v3', TRUE,
    pg_catalog.jsonb_build_object(
      'benefit_code', 'signup_all_products',
      'benefit_version', 'v3',
      'smart_tokens', 400,
      'email_confirmation_required', TRUE
    )
  )
  ON CONFLICT DO NOTHING;

  UPDATE public.profiles p
     SET saldo_creditos = COALESCE((
       SELECT pg_catalog.sum(cl.remaining_amount)
         FROM public.credit_lots cl
        WHERE cl.user_id = NEW.id
          AND cl.status = 'active'
          AND cl.remaining_amount > 0
          AND (cl.hidden_from_ui = FALSE OR cl.source = 'trial')
          AND (cl.expires_at IS NULL OR cl.expires_at > pg_catalog.now())
     ), 0)::BIGINT,
         creditos_expiram_em = NULL
   WHERE p.id = NEW.id;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reserve_credits_from_lots(UUID,BIGINT,TEXT,UUID,TEXT,JSONB) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.grant_confirmed_email_trial() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_credits_from_lots(UUID,BIGINT,TEXT,UUID,TEXT,JSONB) TO service_role;
REVOKE EXECUTE ON FUNCTION public.prepare_smart_space_request(UUID,UUID,INTEGER,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.prepare_smart_space_request(UUID,UUID,INTEGER,TEXT,TEXT,TEXT,BOOLEAN) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_smart_space_request(UUID,UUID,INTEGER,TEXT,TEXT,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.prepare_smart_space_request(UUID,UUID,INTEGER,TEXT,TEXT,TEXT,BOOLEAN) TO service_role;
