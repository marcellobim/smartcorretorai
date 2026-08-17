-- Product 2: durable batch claim, one FEFO reservation and atomic per-item settlement.

ALTER TABLE public.credit_reservation_allocations
  ADD COLUMN IF NOT EXISTS consumed_amount BIGINT NOT NULL DEFAULT 0 CHECK (consumed_amount >= 0),
  ADD COLUMN IF NOT EXISTS refunded_amount BIGINT NOT NULL DEFAULT 0 CHECK (refunded_amount >= 0);

CREATE TABLE public.quick_banner_delivery_requests (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_request_id UUID NOT NULL,
  product_code TEXT NOT NULL DEFAULT 'quick_banners' CHECK (product_code = 'quick_banners'),
  item_count INTEGER NOT NULL CHECK (item_count BETWEEN 1 AND 5),
  unit_cost BIGINT NOT NULL DEFAULT 45 CHECK (unit_cost = 45),
  smart_tokens_quoted BIGINT NOT NULL CHECK (smart_tokens_quoted = item_count * unit_cost),
  smart_tokens_reserved BIGINT NOT NULL CHECK (smart_tokens_reserved IN (0, smart_tokens_quoted)),
  smart_tokens_consumed BIGINT NOT NULL DEFAULT 0 CHECK (smart_tokens_consumed >= 0),
  smart_tokens_refunded BIGINT NOT NULL DEFAULT 0 CHECK (smart_tokens_refunded >= 0),
  completed_count INTEGER NOT NULL DEFAULT 0 CHECK (completed_count BETWEEN 0 AND 5),
  failed_count INTEGER NOT NULL DEFAULT 0 CHECK (failed_count BETWEEN 0 AND 5),
  reservation_id UUID NULL REFERENCES public.credit_reservations(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('preparing', 'prepared', 'processing', 'completed', 'failed')),
  claim_token UUID NOT NULL DEFAULT pg_catalog.gen_random_uuid(),
  admin_bypass BOOLEAN NOT NULL DEFAULT FALSE,
  catalog_version TEXT NOT NULL,
  failure_reason TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  started_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now() + INTERVAL '2 hours',
  CONSTRAINT quick_banner_delivery_identity_unique UNIQUE (user_id, product_code, client_request_id),
  CONSTRAINT quick_banner_delivery_resolution_check CHECK (
    smart_tokens_consumed + smart_tokens_refunded <= smart_tokens_reserved
  )
);

CREATE TABLE public.quick_banner_delivery_items (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.quick_banner_delivery_requests(id) ON DELETE CASCADE,
  item_index INTEGER NOT NULL CHECK (item_index BETWEEN 0 AND 4),
  piece_id TEXT NOT NULL CHECK (pg_catalog.length(piece_id) BETWEEN 1 AND 240),
  template_id UUID NOT NULL,
  media_class TEXT NOT NULL CHECK (media_class IN ('static', 'video')),
  unit_cost BIGINT NOT NULL DEFAULT 45 CHECK (unit_cost = 45),
  render_id TEXT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'rendering', 'completed', 'failed')),
  attempt INTEGER NOT NULL DEFAULT 1 CHECK (attempt > 0),
  retry_of_item_id UUID NULL REFERENCES public.quick_banner_delivery_items(id) ON DELETE RESTRICT,
  retry_request_id UUID NULL REFERENCES public.quick_banner_delivery_requests(id) ON DELETE RESTRICT,
  provider_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  completed_at TIMESTAMPTZ NULL,
  failed_at TIMESTAMPTZ NULL,
  CONSTRAINT quick_banner_item_index_unique UNIQUE (request_id, item_index),
  CONSTRAINT quick_banner_piece_unique UNIQUE (request_id, piece_id),
  CONSTRAINT quick_banner_render_unique UNIQUE (render_id)
);

CREATE TABLE public.quick_banner_item_allocations (
  item_id UUID NOT NULL REFERENCES public.quick_banner_delivery_items(id) ON DELETE CASCADE,
  lot_id UUID NOT NULL REFERENCES public.credit_lots(id) ON DELETE RESTRICT,
  amount BIGINT NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'consumed', 'refunded', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  settled_at TIMESTAMPTZ NULL,
  PRIMARY KEY (item_id, lot_id)
);

CREATE INDEX idx_quick_banner_requests_user ON public.quick_banner_delivery_requests(user_id, created_at DESC);
CREATE INDEX idx_quick_banner_requests_status ON public.quick_banner_delivery_requests(status, expires_at);
CREATE INDEX idx_quick_banner_items_request ON public.quick_banner_delivery_items(request_id, item_index);
CREATE INDEX idx_quick_banner_items_status ON public.quick_banner_delivery_items(status);
CREATE INDEX idx_quick_banner_item_allocations_lot ON public.quick_banner_item_allocations(lot_id);

ALTER TABLE public.quick_banner_delivery_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_banner_delivery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_banner_item_allocations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.quick_banner_delivery_requests FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.quick_banner_delivery_items FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.quick_banner_item_allocations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.quick_banner_delivery_requests TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.quick_banner_delivery_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.quick_banner_item_allocations TO service_role;

CREATE OR REPLACE FUNCTION public.claim_quick_banner_delivery(
  p_user_id UUID, p_client_request_id UUID, p_catalog_version TEXT,
  p_items JSONB, p_admin_bypass BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  request_id UUID, request_status TEXT, returned_claim_token UUID,
  returned_reservation_id UUID, returned_item_count INTEGER,
  returned_quoted_tokens BIGINT, returned_reserved_tokens BIGINT,
  returned_items JSONB, claimed BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_request public.quick_banner_delivery_requests%ROWTYPE;
  v_count INTEGER;
  v_claimed BOOLEAN := FALSE;
  v_item JSONB;
  v_original public.quick_banner_delivery_items%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Nao autorizado' USING ERRCODE = '42501'; END IF;
  IF p_user_id IS NULL OR p_client_request_id IS NULL OR p_catalog_version IS NULL THEN RAISE EXCEPTION 'identidade obrigatoria'; END IF;
  IF pg_catalog.jsonb_typeof(p_items) <> 'array' THEN RAISE EXCEPTION 'items deve ser array'; END IF;
  v_count := pg_catalog.jsonb_array_length(p_items);
  IF v_count < 1 OR v_count > 5 THEN RAISE EXCEPTION 'quantidade deve estar entre 1 e 5'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.jsonb_array_elements(p_items) i
    WHERE COALESCE(i->>'piece_id', '') = ''
       OR COALESCE(i->>'media_class', '') NOT IN ('static', 'video')
       OR COALESCE((i->>'unit_cost')::BIGINT, 0) <> 45
  ) THEN RAISE EXCEPTION 'item economico invalido'; END IF;

  INSERT INTO public.quick_banner_delivery_requests(
    user_id, client_request_id, item_count, smart_tokens_quoted,
    smart_tokens_reserved, status, admin_bypass, catalog_version
  ) VALUES (
    p_user_id, p_client_request_id, v_count, v_count * 45,
    0,
    'preparing', p_admin_bypass, p_catalog_version
  ) ON CONFLICT (user_id, product_code, client_request_id) DO NOTHING
  RETURNING * INTO v_request;

  IF FOUND THEN
    v_claimed := TRUE;
    FOR v_item IN SELECT value FROM pg_catalog.jsonb_array_elements(p_items) LOOP
      IF NULLIF(v_item->>'retry_of_item_id', '') IS NOT NULL THEN
        SELECT * INTO v_original FROM public.quick_banner_delivery_items
         WHERE id = (v_item->>'retry_of_item_id')::UUID FOR UPDATE;
        IF NOT FOUND OR v_original.status <> 'failed' OR v_original.retry_request_id IS NOT NULL
           OR NOT EXISTS (SELECT 1 FROM public.quick_banner_delivery_requests r WHERE r.id = v_original.request_id AND r.user_id = p_user_id)
        THEN RAISE EXCEPTION 'retry de item invalido'; END IF;
      END IF;
    END LOOP;

    INSERT INTO public.quick_banner_delivery_items(
      request_id, item_index, piece_id, template_id, media_class, unit_cost,
      attempt, retry_of_item_id
    )
    SELECT v_request.id, (ordinality - 1)::INTEGER, item->>'piece_id',
      (item->>'template_id')::UUID, item->>'media_class', 45,
      COALESCE(original.attempt + 1, 1), NULLIF(item->>'retry_of_item_id', '')::UUID
    FROM pg_catalog.jsonb_array_elements(p_items) WITH ORDINALITY AS source(item, ordinality)
    LEFT JOIN public.quick_banner_delivery_items original ON original.id = NULLIF(item->>'retry_of_item_id', '')::UUID;

    UPDATE public.quick_banner_delivery_items original
       SET retry_request_id = v_request.id
      FROM public.quick_banner_delivery_items retry
     WHERE retry.request_id = v_request.id AND retry.retry_of_item_id = original.id;
  ELSE
    SELECT * INTO v_request FROM public.quick_banner_delivery_requests
     WHERE user_id = p_user_id AND product_code = 'quick_banners' AND client_request_id = p_client_request_id;
  END IF;

  IF v_request.item_count <> v_count OR v_request.smart_tokens_quoted <> v_count * 45 OR v_request.catalog_version <> p_catalog_version THEN
    RAISE EXCEPTION 'request existente diverge da cotacao';
  END IF;
  RETURN QUERY SELECT v_request.id, v_request.status,
    CASE WHEN v_claimed THEN v_request.claim_token ELSE NULL END,
    v_request.reservation_id, v_request.item_count, v_request.smart_tokens_quoted,
    v_request.smart_tokens_reserved,
    COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(i) ORDER BY i.item_index) FROM public.quick_banner_delivery_items i WHERE i.request_id = v_request.id), '[]'::jsonb),
    v_claimed;
END; $$;

CREATE OR REPLACE FUNCTION public.attach_quick_banner_reservation(
  p_user_id UUID, p_client_request_id UUID, p_claim_token UUID, p_reservation_id UUID
)
RETURNS SETOF public.quick_banner_delivery_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_request public.quick_banner_delivery_requests%ROWTYPE;
  v_reservation public.credit_reservations%ROWTYPE;
  v_item public.quick_banner_delivery_items%ROWTYPE;
  v_allocation RECORD;
  v_missing BIGINT;
  v_take BIGINT;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Nao autorizado' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_request FROM public.quick_banner_delivery_requests
   WHERE user_id = p_user_id AND client_request_id = p_client_request_id FOR UPDATE;
  IF NOT FOUND OR v_request.claim_token <> p_claim_token OR v_request.status NOT IN ('preparing', 'prepared') OR v_request.admin_bypass THEN
    RAISE EXCEPTION 'claim invalido';
  END IF;
  IF v_request.reservation_id IS NOT NULL THEN RETURN NEXT v_request; RETURN; END IF;
  SELECT * INTO v_reservation FROM public.credit_reservations WHERE id = p_reservation_id FOR UPDATE;
  IF NOT FOUND OR v_reservation.user_id <> p_user_id OR v_reservation.status <> 'reserved' OR v_reservation.amount <> v_request.smart_tokens_quoted THEN
    RAISE EXCEPTION 'reserva total invalida';
  END IF;
  UPDATE public.quick_banner_delivery_requests SET reservation_id = p_reservation_id,
    smart_tokens_reserved = smart_tokens_quoted, status = 'prepared'
   WHERE id = v_request.id RETURNING * INTO v_request;

  FOR v_item IN SELECT * FROM public.quick_banner_delivery_items WHERE request_id = v_request.id ORDER BY item_index FOR UPDATE LOOP
    v_missing := v_item.unit_cost;
    FOR v_allocation IN
      SELECT cra.lot_id, cra.amount - COALESCE((SELECT pg_catalog.sum(q.amount) FROM public.quick_banner_item_allocations q
        JOIN public.quick_banner_delivery_items qi ON qi.id = q.item_id
        WHERE qi.request_id = v_request.id AND q.lot_id = cra.lot_id), 0) AS available
      FROM public.credit_reservation_allocations cra
      JOIN public.credit_lots cl ON cl.id = cra.lot_id
      WHERE cra.reservation_id = p_reservation_id AND cra.status = 'reserved'
      ORDER BY cl.expires_at ASC NULLS LAST, cl.created_at, cl.id
    LOOP
      EXIT WHEN v_missing = 0;
      IF v_allocation.available <= 0 THEN CONTINUE; END IF;
      v_take := LEAST(v_missing, v_allocation.available);
      INSERT INTO public.quick_banner_item_allocations(item_id, lot_id, amount) VALUES (v_item.id, v_allocation.lot_id, v_take);
      v_missing := v_missing - v_take;
    END LOOP;
    IF v_missing <> 0 THEN RAISE EXCEPTION 'falha ao associar item aos lotes FEFO'; END IF;
  END LOOP;
  RETURN NEXT v_request;
END; $$;

CREATE OR REPLACE FUNCTION public.begin_quick_banner_execution(p_user_id UUID, p_client_request_id UUID, p_claim_token UUID)
RETURNS TABLE (
  request_id UUID, request_status TEXT, returned_claim_token UUID,
  returned_reservation_id UUID, returned_item_count INTEGER,
  returned_quoted_tokens BIGINT, returned_reserved_tokens BIGINT,
  returned_items JSONB, claimed BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_request public.quick_banner_delivery_requests%ROWTYPE; v_started BOOLEAN := FALSE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Nao autorizado' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_request FROM public.quick_banner_delivery_requests WHERE user_id=p_user_id AND client_request_id=p_client_request_id FOR UPDATE;
  IF NOT FOUND OR v_request.claim_token <> p_claim_token THEN RAISE EXCEPTION 'claim invalido'; END IF;
  IF v_request.status IN ('completed','failed') THEN v_started := FALSE;
  ELSIF v_request.status = 'processing' THEN v_started := FALSE;
  ELSIF v_request.status = 'prepared' OR (v_request.status='preparing' AND v_request.admin_bypass) THEN
    UPDATE public.quick_banner_delivery_requests SET status='processing', started_at=pg_catalog.now()
     WHERE id=v_request.id RETURNING * INTO v_request; v_started := TRUE;
  ELSE RAISE EXCEPTION 'request nao preparado'; END IF;
  RETURN QUERY SELECT v_request.id,v_request.status,v_request.claim_token,v_request.reservation_id,
    v_request.item_count,v_request.smart_tokens_quoted,v_request.smart_tokens_reserved,
    COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(i) ORDER BY i.item_index) FROM public.quick_banner_delivery_items i WHERE i.request_id=v_request.id),'[]'::jsonb),v_started;
END; $$;

CREATE OR REPLACE FUNCTION public.mark_quick_banner_item_rendering(
  p_user_id UUID, p_client_request_id UUID, p_claim_token UUID,
  p_item_id UUID, p_render_id TEXT, p_provider_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS SETOF public.quick_banner_delivery_items
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_item public.quick_banner_delivery_items%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Nao autorizado' USING ERRCODE = '42501'; END IF;
  SELECT i.* INTO v_item FROM public.quick_banner_delivery_items i JOIN public.quick_banner_delivery_requests r ON r.id=i.request_id
   WHERE i.id=p_item_id AND r.user_id=p_user_id AND r.client_request_id=p_client_request_id AND r.claim_token=p_claim_token FOR UPDATE OF i;
  IF NOT FOUND OR v_item.status NOT IN ('pending','rendering') THEN RAISE EXCEPTION 'item invalido para render'; END IF;
  IF v_item.render_id IS NOT NULL AND v_item.render_id <> p_render_id THEN RAISE EXCEPTION 'item ja possui outro render'; END IF;
  UPDATE public.quick_banner_delivery_items SET status='rendering',render_id=p_render_id,
    provider_metadata=COALESCE(provider_metadata,'{}'::jsonb)||COALESCE(p_provider_metadata,'{}'::jsonb)
   WHERE id=p_item_id RETURNING * INTO v_item;
  RETURN NEXT v_item;
END; $$;

CREATE OR REPLACE FUNCTION public.finalize_quick_banner_item(
  p_user_id UUID, p_item_id UUID, p_render_status TEXT, p_result JSONB DEFAULT '{}'::jsonb
)
RETURNS SETOF public.quick_banner_delivery_items
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_item public.quick_banner_delivery_items%ROWTYPE; v_final TEXT;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Nao autorizado' USING ERRCODE = '42501'; END IF;
  SELECT i.* INTO v_item FROM public.quick_banner_delivery_items i JOIN public.quick_banner_delivery_requests r ON r.id=i.request_id
   WHERE i.id=p_item_id AND r.user_id=p_user_id FOR UPDATE OF i;
  IF NOT FOUND THEN RAISE EXCEPTION 'item nao encontrado'; END IF;
  IF v_item.status IN ('completed','failed') THEN RETURN NEXT v_item; RETURN; END IF;
  v_final := CASE WHEN pg_catalog.lower(p_render_status) IN ('succeeded','completed') THEN 'completed'
                  WHEN pg_catalog.lower(p_render_status) IN ('failed','error','canceled','timeout') THEN 'failed' ELSE NULL END;
  IF v_final IS NULL THEN RETURN NEXT v_item; RETURN; END IF;
  UPDATE public.quick_banner_delivery_items SET status=v_final,result=COALESCE(p_result,'{}'::jsonb),
    completed_at=CASE WHEN v_final='completed' THEN pg_catalog.now() ELSE NULL END,
    failed_at=CASE WHEN v_final='failed' THEN pg_catalog.now() ELSE NULL END
   WHERE id=p_item_id RETURNING * INTO v_item;
  RETURN NEXT v_item;
END; $$;

CREATE OR REPLACE FUNCTION public.settle_quick_banner_delivery(p_user_id UUID, p_client_request_id UUID)
RETURNS SETOF public.quick_banner_delivery_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_request public.quick_banner_delivery_requests%ROWTYPE;
  v_slice RECORD;
  v_lot public.credit_lots%ROWTYPE;
  v_completed INTEGER; v_failed INTEGER; v_consumed BIGINT; v_refunded BIGINT; v_balance BIGINT;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Nao autorizado' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_request FROM public.quick_banner_delivery_requests WHERE user_id=p_user_id AND client_request_id=p_client_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request nao encontrado'; END IF;
  IF v_request.status IN ('completed','failed') THEN RETURN NEXT v_request; RETURN; END IF;
  SELECT pg_catalog.count(*) FILTER (WHERE status='completed'), pg_catalog.count(*) FILTER (WHERE status='failed')
    INTO v_completed,v_failed FROM public.quick_banner_delivery_items WHERE request_id=v_request.id;
  IF v_completed+v_failed <> v_request.item_count THEN RETURN NEXT v_request; RETURN; END IF;
  v_consumed := CASE WHEN v_request.admin_bypass THEN 0 ELSE v_completed*45 END;
  v_refunded := CASE WHEN v_request.admin_bypass THEN 0 ELSE v_failed*45 END;

  IF NOT v_request.admin_bypass THEN
    IF v_request.reservation_id IS NULL THEN RAISE EXCEPTION 'request sem reserva total'; END IF;
    FOR v_slice IN
      SELECT q.*,i.status AS item_status FROM public.quick_banner_item_allocations q
      JOIN public.quick_banner_delivery_items i ON i.id=q.item_id
      WHERE i.request_id=v_request.id AND q.status='reserved' ORDER BY q.created_at,q.item_id,q.lot_id FOR UPDATE OF q
    LOOP
      IF v_slice.item_status='completed' THEN
        UPDATE public.quick_banner_item_allocations SET status='consumed',settled_at=pg_catalog.now()
         WHERE item_id=v_slice.item_id AND lot_id=v_slice.lot_id;
      ELSE
        SELECT * INTO v_lot FROM public.credit_lots WHERE id=v_slice.lot_id FOR UPDATE;
        IF v_lot.status='revoked' OR (v_lot.expires_at IS NOT NULL AND v_lot.expires_at<=pg_catalog.now()) THEN
          UPDATE public.credit_lots SET remaining_amount=0,status=CASE WHEN status='revoked' THEN 'revoked' ELSE 'expired' END WHERE id=v_lot.id;
          UPDATE public.quick_banner_item_allocations SET status='expired',settled_at=pg_catalog.now() WHERE item_id=v_slice.item_id AND lot_id=v_slice.lot_id;
        ELSE
          IF v_lot.remaining_amount+v_slice.amount>v_lot.original_amount THEN RAISE EXCEPTION 'estorno excede lote original'; END IF;
          UPDATE public.credit_lots SET remaining_amount=remaining_amount+v_slice.amount,status='active' WHERE id=v_lot.id;
          UPDATE public.quick_banner_item_allocations SET status='refunded',settled_at=pg_catalog.now() WHERE item_id=v_slice.item_id AND lot_id=v_slice.lot_id;
        END IF;
      END IF;
    END LOOP;

    UPDATE public.credit_reservation_allocations cra SET
      consumed_amount=COALESCE((SELECT pg_catalog.sum(q.amount) FROM public.quick_banner_item_allocations q JOIN public.quick_banner_delivery_items i ON i.id=q.item_id WHERE i.request_id=v_request.id AND q.lot_id=cra.lot_id AND q.status='consumed'),0),
      refunded_amount=COALESCE((SELECT pg_catalog.sum(q.amount) FROM public.quick_banner_item_allocations q JOIN public.quick_banner_delivery_items i ON i.id=q.item_id WHERE i.request_id=v_request.id AND q.lot_id=cra.lot_id AND q.status IN ('refunded','expired')),0),
      status=CASE WHEN EXISTS(SELECT 1 FROM public.quick_banner_item_allocations q JOIN public.quick_banner_delivery_items i ON i.id=q.item_id WHERE i.request_id=v_request.id AND q.lot_id=cra.lot_id AND q.status='consumed') THEN 'consumed' ELSE 'cancelled' END,
      consumed_at=CASE WHEN EXISTS(SELECT 1 FROM public.quick_banner_item_allocations q JOIN public.quick_banner_delivery_items i ON i.id=q.item_id WHERE i.request_id=v_request.id AND q.lot_id=cra.lot_id AND q.status='consumed') THEN pg_catalog.now() ELSE NULL END,
      cancelled_at=CASE WHEN EXISTS(SELECT 1 FROM public.quick_banner_item_allocations q JOIN public.quick_banner_delivery_items i ON i.id=q.item_id WHERE i.request_id=v_request.id AND q.lot_id=cra.lot_id AND q.status IN ('refunded','expired')) THEN pg_catalog.now() ELSE NULL END
    WHERE cra.reservation_id=v_request.reservation_id;

    v_balance := public.sync_credit_balance_cache_from_lots(p_user_id);
    IF v_consumed>0 THEN
      INSERT INTO public.credit_transactions(user_id,tipo,creditos,saldo_resultante,observacao,metadata)
      VALUES(p_user_id,'consumo',-v_consumed,v_balance,'Banners Rapidos entregues',
        pg_catalog.jsonb_build_object('product_code','quick_banners','request_id',v_request.id,'reservation_id',v_request.reservation_id,'completed_count',v_completed,'failed_count',v_failed,'smart_tokens_consumed',v_consumed,'smart_tokens_refunded',v_refunded));
    END IF;
    UPDATE public.credit_reservations SET status=CASE WHEN v_consumed>0 THEN 'consumed' ELSE 'cancelled' END,
      consumed_at=CASE WHEN v_consumed>0 THEN pg_catalog.now() ELSE NULL END,
      cancelled_at=CASE WHEN v_consumed=0 THEN pg_catalog.now() ELSE NULL END,
      metadata=COALESCE(metadata,'{}'::jsonb)||pg_catalog.jsonb_build_object('partial_settlement',true,'smart_tokens_consumed',v_consumed,'smart_tokens_refunded',v_refunded)
    WHERE id=v_request.reservation_id;
  END IF;

  UPDATE public.quick_banner_delivery_requests SET status=CASE WHEN v_completed>0 THEN 'completed' ELSE 'failed' END,
    completed_count=v_completed,failed_count=v_failed,smart_tokens_consumed=v_consumed,smart_tokens_refunded=v_refunded,
    completed_at=pg_catalog.now(),metadata=COALESCE(metadata,'{}'::jsonb)||pg_catalog.jsonb_build_object('provider','creatomate','settled',true)
  WHERE id=v_request.id RETURNING * INTO v_request;

  INSERT INTO public.economic_generation_events(user_id,reservation_id,product_code,variant,provider,quantity,usage,catalog_version,status,idempotency_key,metadata)
  VALUES(p_user_id,v_request.reservation_id,'quick_banners','batch','creatomate',v_request.item_count,'{}'::jsonb,v_request.catalog_version,
    CASE WHEN v_completed>0 THEN 'delivered' ELSE 'refunded' END,'quick_banners:batch:'||v_request.id,
    pg_catalog.jsonb_build_object('item_count',v_request.item_count,'completed_count',v_completed,'failed_count',v_failed,'smart_tokens_reserved',v_request.smart_tokens_reserved,'smart_tokens_consumed',v_consumed,'smart_tokens_refunded',v_refunded))
  ON CONFLICT(idempotency_key) DO UPDATE SET status=EXCLUDED.status,metadata=EXCLUDED.metadata;

  INSERT INTO public.economic_generation_events(
    user_id,reservation_id,product_code,variant,provider,model,quantity,usage,catalog_version,status,idempotency_key,metadata
  )
  SELECT p_user_id,v_request.reservation_id,'quick_banners','item','creatomate',i.template_id::text,1,
    pg_catalog.jsonb_build_object('smart_tokens',CASE WHEN NOT v_request.admin_bypass AND i.status='completed' THEN i.unit_cost ELSE 0 END),
    v_request.catalog_version,CASE WHEN i.status='completed' THEN 'delivered' ELSE 'refunded' END,
    'quick_banners:item:'||i.id,
    pg_catalog.jsonb_build_object(
      'request_id',v_request.id,'item_id',i.id,'piece_id',i.piece_id,'media_class',i.media_class,
      'render_id',i.render_id,'render_status',i.render_status,'smart_tokens_reserved',CASE WHEN v_request.admin_bypass THEN 0 ELSE i.unit_cost END,
      'smart_tokens_consumed',CASE WHEN NOT v_request.admin_bypass AND i.status='completed' THEN i.unit_cost ELSE 0 END,
      'smart_tokens_refunded',CASE WHEN NOT v_request.admin_bypass AND i.status='failed' THEN i.unit_cost ELSE 0 END,
      'lot_slices',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('lot_id',a.lot_id,'amount',a.amount,'status',a.status) ORDER BY a.created_at,a.lot_id),'[]'::jsonb) FROM public.quick_banner_item_allocations a WHERE a.item_id=i.id)
    )
  FROM public.quick_banner_delivery_items i WHERE i.request_id=v_request.id
  ON CONFLICT(idempotency_key) DO UPDATE SET status=EXCLUDED.status,usage=EXCLUDED.usage,metadata=EXCLUDED.metadata;
  RETURN NEXT v_request;
END; $$;

CREATE OR REPLACE FUNCTION public.fail_quick_banner_prepared_delivery(
  p_user_id UUID,p_client_request_id UUID,p_claim_token UUID,p_reason TEXT
)
RETURNS TABLE (
  request_id UUID, request_status TEXT, returned_claim_token UUID,
  returned_reservation_id UUID, returned_item_count INTEGER,
  returned_quoted_tokens BIGINT, returned_reserved_tokens BIGINT,
  returned_items JSONB, claimed BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_request public.quick_banner_delivery_requests%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Nao autorizado' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_request FROM public.quick_banner_delivery_requests WHERE user_id=p_user_id AND client_request_id=p_client_request_id FOR UPDATE;
  IF NOT FOUND OR v_request.claim_token<>p_claim_token THEN RAISE EXCEPTION 'claim invalido'; END IF;
  UPDATE public.quick_banner_delivery_items SET status='failed',failed_at=pg_catalog.now(),result=pg_catalog.jsonb_build_object('reason',p_reason)
   WHERE request_id=v_request.id AND status IN ('pending','rendering');
  IF v_request.reservation_id IS NULL THEN
    UPDATE public.quick_banner_delivery_requests SET status='failed',failed_count=item_count,
      failure_reason=p_reason,completed_at=pg_catalog.now() WHERE id=v_request.id RETURNING * INTO v_request;
    RETURN QUERY SELECT v_request.id,v_request.status,v_request.claim_token,v_request.reservation_id,v_request.item_count,
      v_request.smart_tokens_quoted,v_request.smart_tokens_reserved,
      COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(i) ORDER BY i.item_index) FROM public.quick_banner_delivery_items i WHERE i.request_id=v_request.id),'[]'::jsonb),TRUE;
    RETURN;
  END IF;
  PERFORM public.settle_quick_banner_delivery(p_user_id,p_client_request_id);
  SELECT * INTO v_request FROM public.quick_banner_delivery_requests WHERE id=v_request.id;
  RETURN QUERY SELECT v_request.id,v_request.status,v_request.claim_token,v_request.reservation_id,v_request.item_count,
    v_request.smart_tokens_quoted,v_request.smart_tokens_reserved,
    COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(i) ORDER BY i.item_index) FROM public.quick_banner_delivery_items i WHERE i.request_id=v_request.id),'[]'::jsonb),TRUE;
END; $$;

REVOKE EXECUTE ON FUNCTION public.claim_quick_banner_delivery(UUID,UUID,TEXT,JSONB,BOOLEAN) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.attach_quick_banner_reservation(UUID,UUID,UUID,UUID) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.begin_quick_banner_execution(UUID,UUID,UUID) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_quick_banner_item_rendering(UUID,UUID,UUID,UUID,TEXT,JSONB) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.finalize_quick_banner_item(UUID,UUID,TEXT,JSONB) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.settle_quick_banner_delivery(UUID,UUID) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.fail_quick_banner_prepared_delivery(UUID,UUID,UUID,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_quick_banner_delivery(UUID,UUID,TEXT,JSONB,BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.attach_quick_banner_reservation(UUID,UUID,UUID,UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.begin_quick_banner_execution(UUID,UUID,UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_quick_banner_item_rendering(UUID,UUID,UUID,UUID,TEXT,JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_quick_banner_item(UUID,UUID,TEXT,JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_quick_banner_delivery(UUID,UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_quick_banner_prepared_delivery(UUID,UUID,UUID,TEXT) TO service_role;
