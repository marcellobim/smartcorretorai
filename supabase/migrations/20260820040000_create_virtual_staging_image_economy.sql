-- Virtual Staging: one durable request, one total FEFO reservation and
-- independent 30-ST settlement for each delivered image.

CREATE TABLE public.virtual_staging_image_requests (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_request_id UUID NOT NULL,
  image_count INTEGER NOT NULL CHECK (image_count BETWEEN 1 AND 5),
  unit_cost BIGINT NOT NULL DEFAULT 30 CHECK (unit_cost = 30),
  smart_tokens_quoted BIGINT NOT NULL CHECK (smart_tokens_quoted = image_count * 30),
  smart_tokens_reserved BIGINT NOT NULL DEFAULT 0 CHECK (smart_tokens_reserved IN (0, smart_tokens_quoted)),
  smart_tokens_consumed BIGINT NOT NULL DEFAULT 0 CHECK (smart_tokens_consumed >= 0),
  smart_tokens_refunded BIGINT NOT NULL DEFAULT 0 CHECK (smart_tokens_refunded >= 0),
  completed_count INTEGER NOT NULL DEFAULT 0 CHECK (completed_count BETWEEN 0 AND 5),
  failed_count INTEGER NOT NULL DEFAULT 0 CHECK (failed_count BETWEEN 0 AND 5),
  reservation_id UUID NULL REFERENCES public.credit_reservations(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'preparing' CHECK (status IN ('preparing','processing','completed','failed')),
  catalog_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  completed_at TIMESTAMPTZ NULL,
  UNIQUE (user_id, client_request_id),
  CHECK (smart_tokens_consumed + smart_tokens_refunded <= smart_tokens_reserved)
);

CREATE TABLE public.virtual_staging_image_items (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.virtual_staging_image_requests(id) ON DELETE CASCADE,
  item_index INTEGER NOT NULL CHECK (item_index BETWEEN 0 AND 4),
  unit_cost BIGINT NOT NULL DEFAULT 30 CHECK (unit_cost = 30),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  smart_tokens_consumed BIGINT NOT NULL DEFAULT 0 CHECK (smart_tokens_consumed IN (0,30)),
  provider TEXT NOT NULL DEFAULT 'openai' CHECK (provider = 'openai'),
  model TEXT NOT NULL DEFAULT 'gpt-image-2' CHECK (model = 'gpt-image-2'),
  quality TEXT NOT NULL DEFAULT 'medium' CHECK (quality = 'medium'),
  output_size TEXT NULL CHECK (output_size IS NULL OR output_size IN ('1024x1024','1536x1024','1024x1536')),
  provider_usage JSONB NOT NULL DEFAULT '{}'::jsonb,
  estimated_cost_usd_micros BIGINT NULL CHECK (estimated_cost_usd_micros IS NULL OR estimated_cost_usd_micros >= 0),
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  failure_reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  started_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  failed_at TIMESTAMPTZ NULL,
  UNIQUE (request_id, item_index)
);

CREATE TABLE public.virtual_staging_image_item_allocations (
  item_id UUID NOT NULL REFERENCES public.virtual_staging_image_items(id) ON DELETE CASCADE,
  lot_id UUID NOT NULL REFERENCES public.credit_lots(id) ON DELETE RESTRICT,
  amount BIGINT NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','consumed','refunded','expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  settled_at TIMESTAMPTZ NULL,
  PRIMARY KEY (item_id, lot_id)
);

CREATE INDEX idx_virtual_staging_requests_user ON public.virtual_staging_image_requests(user_id, created_at DESC);
CREATE INDEX idx_virtual_staging_items_request ON public.virtual_staging_image_items(request_id, item_index);
CREATE INDEX idx_virtual_staging_items_status ON public.virtual_staging_image_items(status, created_at);

ALTER TABLE public.virtual_staging_image_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.virtual_staging_image_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.virtual_staging_image_item_allocations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.virtual_staging_image_requests FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.virtual_staging_image_items FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.virtual_staging_image_item_allocations FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.virtual_staging_image_requests TO service_role;
GRANT ALL ON TABLE public.virtual_staging_image_items TO service_role;
GRANT ALL ON TABLE public.virtual_staging_image_item_allocations TO service_role;

CREATE OR REPLACE FUNCTION public.prepare_virtual_staging_image_request(
  p_user_id UUID, p_client_request_id UUID, p_image_count INTEGER, p_catalog_version TEXT
)
RETURNS SETOF public.virtual_staging_image_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_request public.virtual_staging_image_requests%ROWTYPE;
  v_reservation public.credit_reservations%ROWTYPE;
  v_item public.virtual_staging_image_items%ROWTYPE;
  v_allocation RECORD; v_missing BIGINT; v_take BIGINT; v_index INTEGER;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Nao autorizado' USING ERRCODE='42501'; END IF;
  IF p_image_count NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'quantidade de imagens invalida'; END IF;

  INSERT INTO public.virtual_staging_image_requests(user_id,client_request_id,image_count,smart_tokens_quoted,catalog_version)
  VALUES(p_user_id,p_client_request_id,p_image_count,p_image_count*30,p_catalog_version)
  ON CONFLICT(user_id,client_request_id) DO NOTHING;
  SELECT * INTO v_request FROM public.virtual_staging_image_requests
   WHERE user_id=p_user_id AND client_request_id=p_client_request_id FOR UPDATE;
  IF v_request.image_count<>p_image_count OR v_request.smart_tokens_quoted<>p_image_count*30 OR v_request.catalog_version<>p_catalog_version THEN
    RAISE EXCEPTION 'request existente diverge da cotacao';
  END IF;
  IF v_request.reservation_id IS NOT NULL THEN RETURN NEXT v_request; RETURN; END IF;

  SELECT * INTO v_reservation FROM public.reserve_credits_from_lots(
    p_user_id,p_image_count*30,'virtual_staging:'||p_client_request_id,NULL,'Virtual Staging',
    pg_catalog.jsonb_build_object('product_code','virtual_staging','variant','image','image_count',p_image_count,'unit_cost',30,'catalog_version',p_catalog_version)
  );
  UPDATE public.virtual_staging_image_requests SET reservation_id=v_reservation.id,smart_tokens_reserved=smart_tokens_quoted,status='processing'
   WHERE id=v_request.id RETURNING * INTO v_request;

  FOR v_index IN 0..p_image_count-1 LOOP
    INSERT INTO public.virtual_staging_image_items(request_id,item_index) VALUES(v_request.id,v_index)
    ON CONFLICT(request_id,item_index) DO NOTHING;
  END LOOP;
  FOR v_item IN SELECT * FROM public.virtual_staging_image_items WHERE request_id=v_request.id ORDER BY item_index FOR UPDATE LOOP
    v_missing:=30;
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

CREATE OR REPLACE FUNCTION public.claim_virtual_staging_image_item(
  p_user_id UUID,p_client_request_id UUID,p_item_index INTEGER
)
RETURNS TABLE(returned_item JSONB,claimed BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_item public.virtual_staging_image_items%ROWTYPE; v_claimed BOOLEAN:=FALSE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Nao autorizado' USING ERRCODE='42501'; END IF;
  SELECT i.* INTO v_item FROM public.virtual_staging_image_items i JOIN public.virtual_staging_image_requests r ON r.id=i.request_id
   WHERE r.user_id=p_user_id AND r.client_request_id=p_client_request_id AND r.status='processing' AND i.item_index=p_item_index FOR UPDATE OF i;
  IF NOT FOUND THEN RAISE EXCEPTION 'imagem economica nao encontrada'; END IF;
  IF v_item.status='pending' THEN
    UPDATE public.virtual_staging_image_items SET status='processing',started_at=pg_catalog.now() WHERE id=v_item.id RETURNING * INTO v_item;
    v_claimed:=TRUE;
  END IF;
  RETURN QUERY SELECT pg_catalog.to_jsonb(v_item),v_claimed;
END; $$;

CREATE OR REPLACE FUNCTION public.settle_virtual_staging_image_request(p_user_id UUID,p_client_request_id UUID)
RETURNS SETOF public.virtual_staging_image_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_request public.virtual_staging_image_requests%ROWTYPE; v_slice RECORD; v_lot public.credit_lots%ROWTYPE;
  v_completed INTEGER; v_failed INTEGER; v_consumed BIGINT; v_refunded BIGINT; v_balance BIGINT;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Nao autorizado' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_request FROM public.virtual_staging_image_requests WHERE user_id=p_user_id AND client_request_id=p_client_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request nao encontrado'; END IF;
  IF v_request.status IN ('completed','failed') THEN RETURN NEXT v_request; RETURN; END IF;
  SELECT pg_catalog.count(*) FILTER(WHERE status='completed'),pg_catalog.count(*) FILTER(WHERE status='failed') INTO v_completed,v_failed
   FROM public.virtual_staging_image_items WHERE request_id=v_request.id;
  IF v_completed+v_failed<>v_request.image_count THEN RETURN NEXT v_request; RETURN; END IF;
  v_consumed:=v_completed*30; v_refunded:=v_failed*30;
  FOR v_slice IN SELECT a.*,i.status AS item_status FROM public.virtual_staging_image_item_allocations a
    JOIN public.virtual_staging_image_items i ON i.id=a.item_id WHERE i.request_id=v_request.id AND a.status='reserved'
    ORDER BY a.created_at,a.item_id,a.lot_id FOR UPDATE OF a
  LOOP
    IF v_slice.item_status='completed' THEN
      UPDATE public.virtual_staging_image_item_allocations SET status='consumed',settled_at=pg_catalog.now() WHERE item_id=v_slice.item_id AND lot_id=v_slice.lot_id;
    ELSE
      SELECT * INTO v_lot FROM public.credit_lots WHERE id=v_slice.lot_id FOR UPDATE;
      IF v_lot.status='revoked' OR (v_lot.expires_at IS NOT NULL AND v_lot.expires_at<=pg_catalog.now()) THEN
        UPDATE public.virtual_staging_image_item_allocations SET status='expired',settled_at=pg_catalog.now() WHERE item_id=v_slice.item_id AND lot_id=v_slice.lot_id;
      ELSE
        IF v_lot.remaining_amount+v_slice.amount>v_lot.original_amount THEN RAISE EXCEPTION 'estorno excede lote original'; END IF;
        UPDATE public.credit_lots SET remaining_amount=remaining_amount+v_slice.amount,status='active' WHERE id=v_lot.id;
        UPDATE public.virtual_staging_image_item_allocations SET status='refunded',settled_at=pg_catalog.now() WHERE item_id=v_slice.item_id AND lot_id=v_slice.lot_id;
      END IF;
    END IF;
  END LOOP;
  UPDATE public.credit_reservation_allocations cra SET
    consumed_amount=COALESCE((SELECT pg_catalog.sum(a.amount) FROM public.virtual_staging_image_item_allocations a JOIN public.virtual_staging_image_items i ON i.id=a.item_id WHERE i.request_id=v_request.id AND a.lot_id=cra.lot_id AND a.status='consumed'),0),
    refunded_amount=COALESCE((SELECT pg_catalog.sum(a.amount) FROM public.virtual_staging_image_item_allocations a JOIN public.virtual_staging_image_items i ON i.id=a.item_id WHERE i.request_id=v_request.id AND a.lot_id=cra.lot_id AND a.status IN ('refunded','expired')),0),
    status=CASE WHEN v_consumed>0 THEN 'consumed' ELSE 'cancelled' END,consumed_at=CASE WHEN v_consumed>0 THEN pg_catalog.now() ELSE NULL END,
    cancelled_at=CASE WHEN v_refunded>0 THEN pg_catalog.now() ELSE NULL END WHERE cra.reservation_id=v_request.reservation_id;
  v_balance:=public.sync_credit_balance_cache_from_lots(p_user_id);
  IF v_consumed>0 THEN INSERT INTO public.credit_transactions(user_id,tipo,creditos,saldo_resultante,observacao,metadata)
    VALUES(p_user_id,'consumo',-v_consumed,v_balance,'Virtual Staging entregue',pg_catalog.jsonb_build_object('product_code','virtual_staging','request_id',v_request.id,'completed_count',v_completed,'failed_count',v_failed)); END IF;
  UPDATE public.credit_reservations SET status=CASE WHEN v_consumed>0 THEN 'consumed' ELSE 'cancelled' END,
    consumed_at=CASE WHEN v_consumed>0 THEN pg_catalog.now() ELSE NULL END,cancelled_at=CASE WHEN v_consumed=0 THEN pg_catalog.now() ELSE NULL END,
    metadata=metadata||pg_catalog.jsonb_build_object('partial_settlement',TRUE,'smart_tokens_consumed',v_consumed,'smart_tokens_refunded',v_refunded)
   WHERE id=v_request.reservation_id;
  UPDATE public.virtual_staging_image_items SET smart_tokens_consumed=CASE WHEN status='completed' THEN 30 ELSE 0 END WHERE request_id=v_request.id;
  UPDATE public.virtual_staging_image_requests SET status=CASE WHEN v_completed>0 THEN 'completed' ELSE 'failed' END,completed_count=v_completed,failed_count=v_failed,
    smart_tokens_consumed=v_consumed,smart_tokens_refunded=v_refunded,completed_at=pg_catalog.now() WHERE id=v_request.id RETURNING * INTO v_request;
  INSERT INTO public.economic_generation_events(user_id,reservation_id,product_code,variant,provider,model,quantity,usage,catalog_version,status,idempotency_key,metadata)
  SELECT p_user_id,v_request.reservation_id,'virtual_staging','image','openai','gpt-image-2',1,i.provider_usage,v_request.catalog_version,
    CASE WHEN i.status='completed' THEN 'delivered' ELSE 'refunded' END,'virtual_staging:image:'||i.id,
    pg_catalog.jsonb_build_object('request_id',v_request.id,'item_id',i.id,'quality',i.quality,'output_size',i.output_size,
      'estimated_cost_usd_micros',i.estimated_cost_usd_micros,'smart_tokens_reserved',30,'smart_tokens_consumed',i.smart_tokens_consumed,
      'smart_tokens_refunded',CASE WHEN i.status='failed' THEN 30 ELSE 0 END)
  FROM public.virtual_staging_image_items i WHERE i.request_id=v_request.id
  ON CONFLICT(idempotency_key) DO UPDATE SET status=EXCLUDED.status,usage=EXCLUDED.usage,metadata=EXCLUDED.metadata;
  RETURN NEXT v_request;
END; $$;

CREATE OR REPLACE FUNCTION public.finalize_virtual_staging_image_item(
  p_user_id UUID,p_client_request_id UUID,p_item_index INTEGER,p_final_status TEXT,
  p_result JSONB DEFAULT '{}'::jsonb,p_usage JSONB DEFAULT '{}'::jsonb,p_output_size TEXT DEFAULT NULL,
  p_estimated_cost_usd_micros BIGINT DEFAULT NULL,p_failure_reason TEXT DEFAULT NULL
)
RETURNS SETOF public.virtual_staging_image_items LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_item public.virtual_staging_image_items%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Nao autorizado' USING ERRCODE='42501'; END IF;
  IF p_final_status NOT IN ('completed','failed') THEN RAISE EXCEPTION 'status terminal invalido'; END IF;
  SELECT i.* INTO v_item FROM public.virtual_staging_image_items i JOIN public.virtual_staging_image_requests r ON r.id=i.request_id
   WHERE r.user_id=p_user_id AND r.client_request_id=p_client_request_id AND i.item_index=p_item_index FOR UPDATE OF i;
  IF NOT FOUND THEN RAISE EXCEPTION 'imagem economica nao encontrada'; END IF;
  IF v_item.status IN ('completed','failed') THEN RETURN NEXT v_item; RETURN; END IF;
  UPDATE public.virtual_staging_image_items SET status=p_final_status,result=COALESCE(p_result,'{}'::jsonb),provider_usage=COALESCE(p_usage,'{}'::jsonb),
    output_size=p_output_size,estimated_cost_usd_micros=p_estimated_cost_usd_micros,failure_reason=p_failure_reason,
    completed_at=CASE WHEN p_final_status='completed' THEN pg_catalog.now() ELSE NULL END,
    failed_at=CASE WHEN p_final_status='failed' THEN pg_catalog.now() ELSE NULL END WHERE id=v_item.id RETURNING * INTO v_item;
  PERFORM public.settle_virtual_staging_image_request(p_user_id,p_client_request_id);
  RETURN NEXT v_item;
END; $$;

REVOKE EXECUTE ON FUNCTION public.prepare_virtual_staging_image_request(UUID,UUID,INTEGER,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_virtual_staging_image_item(UUID,UUID,INTEGER) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.finalize_virtual_staging_image_item(UUID,UUID,INTEGER,TEXT,JSONB,JSONB,TEXT,BIGINT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.settle_virtual_staging_image_request(UUID,UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_virtual_staging_image_request(UUID,UUID,INTEGER,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_virtual_staging_image_item(UUID,UUID,INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_virtual_staging_image_item(UUID,UUID,INTEGER,TEXT,JSONB,JSONB,TEXT,BIGINT,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_virtual_staging_image_request(UUID,UUID) TO service_role;
