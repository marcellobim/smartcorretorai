-- Product 3: Banner Imobiliario. Durable batch claim, total FEFO reservation,
-- per-piece allocations and idempotent pro-rata settlement.

CREATE TABLE public.real_estate_banner_requests (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_request_id UUID NOT NULL,
  product_code TEXT NOT NULL DEFAULT 'real_estate_banner' CHECK (product_code = 'real_estate_banner'),
  selected_format_count INTEGER NOT NULL CHECK (selected_format_count BETWEEN 1 AND 6),
  creation_options INTEGER NOT NULL CHECK (creation_options BETWEEN 1 AND 3),
  item_count INTEGER NOT NULL CHECK (item_count BETWEEN 1 AND 6),
  unit_cost BIGINT NOT NULL DEFAULT 75 CHECK (unit_cost = 75),
  smart_tokens_quoted BIGINT NOT NULL CHECK (smart_tokens_quoted = item_count * unit_cost),
  smart_tokens_reserved BIGINT NOT NULL DEFAULT 0 CHECK (smart_tokens_reserved IN (0, smart_tokens_quoted)),
  smart_tokens_consumed BIGINT NOT NULL DEFAULT 0 CHECK (smart_tokens_consumed >= 0),
  smart_tokens_refunded BIGINT NOT NULL DEFAULT 0 CHECK (smart_tokens_refunded >= 0),
  completed_count INTEGER NOT NULL DEFAULT 0 CHECK (completed_count BETWEEN 0 AND 6),
  failed_count INTEGER NOT NULL DEFAULT 0 CHECK (failed_count BETWEEN 0 AND 6),
  reservation_id UUID NULL REFERENCES public.credit_reservations(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'preparing' CHECK (status IN ('preparing','prepared','processing','completed','failed')),
  claim_token UUID NOT NULL DEFAULT pg_catalog.gen_random_uuid(),
  catalog_version TEXT NOT NULL,
  failure_reason TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  started_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now() + INTERVAL '2 hours',
  CONSTRAINT real_estate_banner_identity_unique UNIQUE (user_id, product_code, client_request_id),
  CONSTRAINT real_estate_banner_multiplicity_check CHECK (item_count = selected_format_count * creation_options),
  CONSTRAINT real_estate_banner_resolution_check CHECK (smart_tokens_consumed + smart_tokens_refunded <= smart_tokens_reserved)
);

CREATE TABLE public.real_estate_banner_items (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.real_estate_banner_requests(id) ON DELETE CASCADE,
  item_index INTEGER NOT NULL CHECK (item_index BETWEEN 0 AND 5),
  piece_id TEXT NOT NULL CHECK (pg_catalog.length(piece_id) BETWEEN 1 AND 240),
  format_id TEXT NOT NULL CHECK (format_id IN ('instagram_feed','story_reels','whatsapp','facebook','google_ads','landing_page','portal')),
  format_group TEXT NOT NULL CHECK (format_group IN ('square_feed','vertical','landscape')),
  creation_option INTEGER NOT NULL CHECK (creation_option BETWEEN 1 AND 3),
  resolution TEXT NOT NULL CHECK (resolution IN ('1024x1024','1024x1536','1536x1024')),
  quality TEXT NOT NULL DEFAULT 'medium' CHECK (quality = 'medium'),
  reference_count INTEGER NOT NULL CHECK (reference_count BETWEEN 0 AND 4),
  unit_cost BIGINT NOT NULL DEFAULT 75 CHECK (unit_cost = 75),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  generation_id UUID NULL REFERENCES public.hero_generations(id) ON DELETE RESTRICT,
  provider_response_id TEXT NULL,
  provider_model TEXT NULL,
  attempt INTEGER NOT NULL DEFAULT 1 CHECK (attempt > 0),
  retry_of_item_id UUID NULL REFERENCES public.real_estate_banner_items(id) ON DELETE RESTRICT,
  provider_usage JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  started_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  failed_at TIMESTAMPTZ NULL,
  CONSTRAINT real_estate_banner_item_index_unique UNIQUE (request_id, item_index),
  CONSTRAINT real_estate_banner_piece_unique UNIQUE (request_id, piece_id),
  CONSTRAINT real_estate_banner_combination_unique UNIQUE (request_id, format_id, creation_option),
  CONSTRAINT real_estate_banner_generation_unique UNIQUE (generation_id),
  CONSTRAINT real_estate_banner_response_unique UNIQUE (provider_response_id)
);

CREATE TABLE public.real_estate_banner_item_allocations (
  item_id UUID NOT NULL REFERENCES public.real_estate_banner_items(id) ON DELETE CASCADE,
  lot_id UUID NOT NULL REFERENCES public.credit_lots(id) ON DELETE RESTRICT,
  amount BIGINT NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','consumed','refunded','expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  settled_at TIMESTAMPTZ NULL,
  PRIMARY KEY (item_id, lot_id)
);

CREATE INDEX idx_real_estate_banner_requests_user ON public.real_estate_banner_requests(user_id, created_at DESC);
CREATE INDEX idx_real_estate_banner_requests_status ON public.real_estate_banner_requests(status, expires_at);
CREATE INDEX idx_real_estate_banner_items_request ON public.real_estate_banner_items(request_id, item_index);
CREATE INDEX idx_real_estate_banner_items_status ON public.real_estate_banner_items(status, created_at);
CREATE INDEX idx_real_estate_banner_allocations_lot ON public.real_estate_banner_item_allocations(lot_id, status);

ALTER TABLE public.real_estate_banner_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.real_estate_banner_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.real_estate_banner_item_allocations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.real_estate_banner_requests FROM PUBLIC,anon,authenticated;
REVOKE ALL ON TABLE public.real_estate_banner_items FROM PUBLIC,anon,authenticated;
REVOKE ALL ON TABLE public.real_estate_banner_item_allocations FROM PUBLIC,anon,authenticated;
GRANT ALL ON TABLE public.real_estate_banner_requests TO service_role;
GRANT ALL ON TABLE public.real_estate_banner_items TO service_role;
GRANT ALL ON TABLE public.real_estate_banner_item_allocations TO service_role;

CREATE OR REPLACE FUNCTION public.claim_real_estate_banner_request(
  p_user_id UUID, p_client_request_id UUID, p_catalog_version TEXT,
  p_selected_format_count INTEGER, p_creation_options INTEGER, p_items JSONB
)
RETURNS TABLE (
  request_id UUID, request_status TEXT, returned_claim_token UUID,
  returned_reservation_id UUID, returned_item_count INTEGER,
  returned_quoted_tokens BIGINT, returned_reserved_tokens BIGINT, returned_items JSONB
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_request public.real_estate_banner_requests%ROWTYPE;
  v_item JSONB; v_index INTEGER := 0; v_total INTEGER; v_retry public.real_estate_banner_items%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Nao autorizado' USING ERRCODE='42501'; END IF;
  IF p_selected_format_count NOT BETWEEN 1 AND 6 OR p_creation_options NOT BETWEEN 1 AND 3 THEN RAISE EXCEPTION 'multiplicidade invalida'; END IF;
  v_total := p_selected_format_count * p_creation_options;
  IF v_total NOT BETWEEN 1 AND 6 OR pg_catalog.jsonb_typeof(p_items) <> 'array' OR pg_catalog.jsonb_array_length(p_items) <> v_total THEN
    RAISE EXCEPTION 'total de geracoes invalido';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(p_items) x
    WHERE (x->>'unit_cost')::BIGINT <> 75
       OR (x->>'reference_count')::INTEGER NOT BETWEEN 0 AND 4
       OR (x->>'creation_option')::INTEGER NOT BETWEEN 1 AND CASE WHEN NULLIF(x->>'retry_of_item_id','') IS NULL THEN p_creation_options ELSE 3 END
       OR x->>'format_id' NOT IN ('instagram_feed','story_reels','whatsapp','facebook','google_ads','landing_page','portal')
       OR x->>'format_group' NOT IN ('square_feed','vertical','landscape')
       OR x->>'resolution' NOT IN ('1024x1024','1024x1536','1536x1024')) THEN
    RAISE EXCEPTION 'item economico invalido';
  END IF;
  IF (SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_array_elements(p_items) x WHERE NULLIF(x->>'retry_of_item_id','') IS NOT NULL) NOT IN (0,1)
     OR ((SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_array_elements(p_items) x WHERE NULLIF(x->>'retry_of_item_id','') IS NOT NULL)=1 AND v_total<>1)
     OR (SELECT pg_catalog.count(DISTINCT x->>'format_id') FROM pg_catalog.jsonb_array_elements(p_items) x) <> p_selected_format_count
     OR (SELECT pg_catalog.count(DISTINCT (x->>'format_id') || ':' || (x->>'creation_option')) FROM pg_catalog.jsonb_array_elements(p_items) x) <> v_total
     OR (SELECT pg_catalog.count(DISTINCT x->>'piece_id') FROM pg_catalog.jsonb_array_elements(p_items) x) <> v_total THEN
    RAISE EXCEPTION 'matriz de formatos invalida';
  END IF;

  INSERT INTO public.real_estate_banner_requests(
    user_id,client_request_id,selected_format_count,creation_options,item_count,
    smart_tokens_quoted,smart_tokens_reserved,status,catalog_version,metadata
  ) VALUES(p_user_id,p_client_request_id,p_selected_format_count,p_creation_options,v_total,v_total*75,0,'preparing',p_catalog_version,
    pg_catalog.jsonb_build_object('provider','openai','quality','medium'))
  ON CONFLICT(user_id,product_code,client_request_id) DO NOTHING;

  SELECT * INTO v_request FROM public.real_estate_banner_requests
   WHERE user_id=p_user_id AND product_code='real_estate_banner' AND client_request_id=p_client_request_id FOR UPDATE;
  IF v_request.item_count<>v_total OR v_request.smart_tokens_quoted<>v_total*75 OR v_request.catalog_version<>p_catalog_version
     OR v_request.selected_format_count<>p_selected_format_count OR v_request.creation_options<>p_creation_options THEN
    RAISE EXCEPTION 'request existente diverge da cotacao';
  END IF;

  IF NOT EXISTS(SELECT 1 FROM public.real_estate_banner_items WHERE request_id=v_request.id) THEN
    FOR v_item IN SELECT value FROM pg_catalog.jsonb_array_elements(p_items) LOOP
      IF NULLIF(v_item->>'retry_of_item_id','') IS NOT NULL THEN
        SELECT i.* INTO v_retry FROM public.real_estate_banner_items i
        JOIN public.real_estate_banner_requests r ON r.id=i.request_id
        WHERE i.id=(v_item->>'retry_of_item_id')::UUID AND r.user_id=p_user_id AND i.status='failed';
        IF NOT FOUND OR v_total<>1 OR v_retry.format_id<>v_item->>'format_id' OR v_retry.creation_option<>(v_item->>'creation_option')::INTEGER THEN
          RAISE EXCEPTION 'retry invalido';
        END IF;
      END IF;
      INSERT INTO public.real_estate_banner_items(
        request_id,item_index,piece_id,format_id,format_group,creation_option,resolution,
        reference_count,retry_of_item_id,attempt
      ) VALUES(v_request.id,v_index,v_item->>'piece_id',v_item->>'format_id',v_item->>'format_group',
        (v_item->>'creation_option')::INTEGER,v_item->>'resolution',(v_item->>'reference_count')::INTEGER,
        NULLIF(v_item->>'retry_of_item_id','')::UUID,CASE WHEN NULLIF(v_item->>'retry_of_item_id','') IS NULL THEN 1 ELSE v_retry.attempt+1 END);
      v_index := v_index+1;
    END LOOP;
  END IF;
  RETURN QUERY SELECT v_request.id,v_request.status,v_request.claim_token,v_request.reservation_id,
    v_request.item_count,v_request.smart_tokens_quoted,v_request.smart_tokens_reserved,
    COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(i) ORDER BY i.item_index) FROM public.real_estate_banner_items i WHERE i.request_id=v_request.id),'[]'::JSONB);
END; $$;

CREATE OR REPLACE FUNCTION public.attach_real_estate_banner_reservation(
  p_user_id UUID,p_client_request_id UUID,p_claim_token UUID,p_reservation_id UUID
)
RETURNS SETOF public.real_estate_banner_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_request public.real_estate_banner_requests%ROWTYPE; v_reservation public.credit_reservations%ROWTYPE;
  v_item public.real_estate_banner_items%ROWTYPE; v_allocation RECORD; v_missing BIGINT; v_take BIGINT;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Nao autorizado' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_request FROM public.real_estate_banner_requests WHERE user_id=p_user_id AND client_request_id=p_client_request_id FOR UPDATE;
  IF NOT FOUND OR v_request.claim_token<>p_claim_token OR v_request.status NOT IN ('preparing','prepared') THEN RAISE EXCEPTION 'claim invalido'; END IF;
  IF v_request.reservation_id IS NOT NULL THEN RETURN NEXT v_request; RETURN; END IF;
  SELECT * INTO v_reservation FROM public.credit_reservations WHERE id=p_reservation_id FOR UPDATE;
  IF NOT FOUND OR v_reservation.user_id<>p_user_id OR v_reservation.status<>'reserved' OR v_reservation.amount<>v_request.smart_tokens_quoted THEN
    RAISE EXCEPTION 'reserva total invalida';
  END IF;
  UPDATE public.real_estate_banner_requests SET reservation_id=p_reservation_id,smart_tokens_reserved=smart_tokens_quoted,status='prepared'
   WHERE id=v_request.id RETURNING * INTO v_request;
  FOR v_item IN SELECT * FROM public.real_estate_banner_items WHERE request_id=v_request.id ORDER BY item_index FOR UPDATE LOOP
    v_missing:=75;
    FOR v_allocation IN
      SELECT cra.lot_id,cra.amount-COALESCE((SELECT pg_catalog.sum(a.amount) FROM public.real_estate_banner_item_allocations a
        JOIN public.real_estate_banner_items i ON i.id=a.item_id WHERE i.request_id=v_request.id AND a.lot_id=cra.lot_id),0) AS available
      FROM public.credit_reservation_allocations cra JOIN public.credit_lots cl ON cl.id=cra.lot_id
      WHERE cra.reservation_id=p_reservation_id AND cra.status='reserved'
      ORDER BY cl.expires_at ASC NULLS LAST,cl.created_at,cl.id
    LOOP
      EXIT WHEN v_missing=0; IF v_allocation.available<=0 THEN CONTINUE; END IF;
      v_take:=LEAST(v_missing,v_allocation.available);
      INSERT INTO public.real_estate_banner_item_allocations(item_id,lot_id,amount) VALUES(v_item.id,v_allocation.lot_id,v_take);
      v_missing:=v_missing-v_take;
    END LOOP;
    IF v_missing<>0 THEN RAISE EXCEPTION 'falha ao associar item aos lotes FEFO'; END IF;
  END LOOP;
  RETURN NEXT v_request;
END; $$;

CREATE OR REPLACE FUNCTION public.begin_real_estate_banner_request(p_user_id UUID,p_client_request_id UUID,p_claim_token UUID)
RETURNS TABLE(request_id UUID,request_status TEXT,returned_claim_token UUID,returned_reservation_id UUID,
  returned_item_count INTEGER,returned_quoted_tokens BIGINT,returned_reserved_tokens BIGINT,returned_items JSONB)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_request public.real_estate_banner_requests%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Nao autorizado' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_request FROM public.real_estate_banner_requests WHERE user_id=p_user_id AND client_request_id=p_client_request_id FOR UPDATE;
  IF NOT FOUND OR v_request.claim_token<>p_claim_token THEN RAISE EXCEPTION 'claim invalido'; END IF;
  IF v_request.status='prepared' THEN UPDATE public.real_estate_banner_requests SET status='processing',started_at=COALESCE(started_at,pg_catalog.now()) WHERE id=v_request.id RETURNING * INTO v_request;
  ELSIF v_request.status NOT IN ('processing','completed','failed') THEN RAISE EXCEPTION 'request nao preparado'; END IF;
  RETURN QUERY SELECT v_request.id,v_request.status,v_request.claim_token,v_request.reservation_id,v_request.item_count,
    v_request.smart_tokens_quoted,v_request.smart_tokens_reserved,
    COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(i) ORDER BY i.item_index) FROM public.real_estate_banner_items i WHERE i.request_id=v_request.id),'[]'::JSONB);
END; $$;

CREATE OR REPLACE FUNCTION public.claim_real_estate_banner_item(p_user_id UUID,p_client_request_id UUID,p_claim_token UUID,p_item_id UUID)
RETURNS TABLE(returned_item JSONB,claimed BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_item public.real_estate_banner_items%ROWTYPE; v_claimed BOOLEAN:=FALSE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Nao autorizado' USING ERRCODE='42501'; END IF;
  SELECT i.* INTO v_item FROM public.real_estate_banner_items i JOIN public.real_estate_banner_requests r ON r.id=i.request_id
   WHERE i.id=p_item_id AND r.user_id=p_user_id AND r.client_request_id=p_client_request_id AND r.claim_token=p_claim_token AND r.status='processing' FOR UPDATE OF i;
  IF NOT FOUND THEN RAISE EXCEPTION 'item nao encontrado'; END IF;
  IF v_item.status='pending' THEN UPDATE public.real_estate_banner_items SET status='processing',started_at=pg_catalog.now() WHERE id=v_item.id RETURNING * INTO v_item; v_claimed:=TRUE; END IF;
  IF v_item.status='processing' AND v_item.provider_response_id IS NULL THEN v_claimed:=TRUE; END IF;
  RETURN QUERY SELECT pg_catalog.to_jsonb(v_item),v_claimed;
END; $$;

CREATE OR REPLACE FUNCTION public.bind_real_estate_banner_generation(p_user_id UUID,p_item_id UUID,p_generation_id UUID)
RETURNS SETOF public.real_estate_banner_items LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_item public.real_estate_banner_items%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Nao autorizado' USING ERRCODE='42501'; END IF;
  SELECT i.* INTO v_item FROM public.real_estate_banner_items i JOIN public.real_estate_banner_requests r ON r.id=i.request_id
   WHERE i.id=p_item_id AND r.user_id=p_user_id FOR UPDATE OF i;
  IF NOT FOUND OR v_item.status<>'processing' OR (v_item.generation_id IS NOT NULL AND v_item.generation_id<>p_generation_id) THEN RAISE EXCEPTION 'item invalido'; END IF;
  UPDATE public.real_estate_banner_items SET generation_id=p_generation_id WHERE id=p_item_id RETURNING * INTO v_item; RETURN NEXT v_item;
END; $$;

CREATE OR REPLACE FUNCTION public.update_real_estate_banner_provider(p_user_id UUID,p_item_id UUID,p_response_id TEXT,p_model TEXT,p_usage JSONB DEFAULT '{}'::JSONB)
RETURNS SETOF public.real_estate_banner_items LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_item public.real_estate_banner_items%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Nao autorizado' USING ERRCODE='42501'; END IF;
  SELECT i.* INTO v_item FROM public.real_estate_banner_items i JOIN public.real_estate_banner_requests r ON r.id=i.request_id WHERE i.id=p_item_id AND r.user_id=p_user_id FOR UPDATE OF i;
  IF NOT FOUND OR v_item.status<>'processing' OR (v_item.provider_response_id IS NOT NULL AND v_item.provider_response_id<>p_response_id) THEN RAISE EXCEPTION 'provider invalido'; END IF;
  UPDATE public.real_estate_banner_items SET provider_response_id=p_response_id,provider_model=p_model,provider_usage=provider_usage||COALESCE(p_usage,'{}'::JSONB)
   WHERE id=p_item_id RETURNING * INTO v_item; RETURN NEXT v_item;
END; $$;

CREATE OR REPLACE FUNCTION public.finalize_real_estate_banner_item(p_user_id UUID,p_item_id UUID,p_final_status TEXT,p_result JSONB DEFAULT '{}'::JSONB,p_usage JSONB DEFAULT '{}'::JSONB)
RETURNS SETOF public.real_estate_banner_items LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_item public.real_estate_banner_items%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Nao autorizado' USING ERRCODE='42501'; END IF;
  IF p_final_status NOT IN ('completed','failed') THEN RAISE EXCEPTION 'status terminal invalido'; END IF;
  SELECT i.* INTO v_item FROM public.real_estate_banner_items i JOIN public.real_estate_banner_requests r ON r.id=i.request_id WHERE i.id=p_item_id AND r.user_id=p_user_id FOR UPDATE OF i;
  IF NOT FOUND THEN RAISE EXCEPTION 'item nao encontrado'; END IF;
  IF v_item.status IN ('completed','failed') THEN RETURN NEXT v_item; RETURN; END IF;
  UPDATE public.real_estate_banner_items SET status=p_final_status,result=COALESCE(p_result,'{}'::JSONB),provider_usage=provider_usage||COALESCE(p_usage,'{}'::JSONB),
    completed_at=CASE WHEN p_final_status='completed' THEN pg_catalog.now() ELSE NULL END,failed_at=CASE WHEN p_final_status='failed' THEN pg_catalog.now() ELSE NULL END
   WHERE id=p_item_id RETURNING * INTO v_item; RETURN NEXT v_item;
END; $$;

CREATE OR REPLACE FUNCTION public.settle_real_estate_banner_request(p_user_id UUID,p_client_request_id UUID)
RETURNS SETOF public.real_estate_banner_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_request public.real_estate_banner_requests%ROWTYPE; v_slice RECORD; v_lot public.credit_lots%ROWTYPE;
  v_completed INTEGER; v_failed INTEGER; v_consumed BIGINT; v_refunded BIGINT; v_balance BIGINT;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Nao autorizado' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_request FROM public.real_estate_banner_requests WHERE user_id=p_user_id AND client_request_id=p_client_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request nao encontrado'; END IF;
  IF v_request.status IN ('completed','failed') THEN RETURN NEXT v_request; RETURN; END IF;
  SELECT pg_catalog.count(*) FILTER(WHERE status='completed'),pg_catalog.count(*) FILTER(WHERE status='failed') INTO v_completed,v_failed
   FROM public.real_estate_banner_items WHERE request_id=v_request.id;
  IF v_completed+v_failed<>v_request.item_count THEN RETURN NEXT v_request; RETURN; END IF;
  IF v_request.reservation_id IS NULL OR v_request.smart_tokens_reserved<>v_request.smart_tokens_quoted THEN RAISE EXCEPTION 'request sem reserva total'; END IF;
  v_consumed:=v_completed*75; v_refunded:=v_failed*75;
  FOR v_slice IN SELECT a.*,i.status AS item_status FROM public.real_estate_banner_item_allocations a
    JOIN public.real_estate_banner_items i ON i.id=a.item_id WHERE i.request_id=v_request.id AND a.status='reserved'
    ORDER BY a.created_at,a.item_id,a.lot_id FOR UPDATE OF a
  LOOP
    IF v_slice.item_status='completed' THEN
      UPDATE public.real_estate_banner_item_allocations SET status='consumed',settled_at=pg_catalog.now() WHERE item_id=v_slice.item_id AND lot_id=v_slice.lot_id;
    ELSE
      SELECT * INTO v_lot FROM public.credit_lots WHERE id=v_slice.lot_id FOR UPDATE;
      IF v_lot.status='revoked' OR (v_lot.expires_at IS NOT NULL AND v_lot.expires_at<=pg_catalog.now()) THEN
        UPDATE public.credit_lots SET remaining_amount=0,status=CASE WHEN status='revoked' THEN 'revoked' ELSE 'expired' END WHERE id=v_lot.id;
        UPDATE public.real_estate_banner_item_allocations SET status='expired',settled_at=pg_catalog.now() WHERE item_id=v_slice.item_id AND lot_id=v_slice.lot_id;
      ELSE
        IF v_lot.remaining_amount+v_slice.amount>v_lot.original_amount THEN RAISE EXCEPTION 'estorno excede lote original'; END IF;
        UPDATE public.credit_lots SET remaining_amount=remaining_amount+v_slice.amount,status='active' WHERE id=v_lot.id;
        UPDATE public.real_estate_banner_item_allocations SET status='refunded',settled_at=pg_catalog.now() WHERE item_id=v_slice.item_id AND lot_id=v_slice.lot_id;
      END IF;
    END IF;
  END LOOP;
  UPDATE public.credit_reservation_allocations cra SET
    consumed_amount=COALESCE((SELECT pg_catalog.sum(a.amount) FROM public.real_estate_banner_item_allocations a JOIN public.real_estate_banner_items i ON i.id=a.item_id WHERE i.request_id=v_request.id AND a.lot_id=cra.lot_id AND a.status='consumed'),0),
    refunded_amount=COALESCE((SELECT pg_catalog.sum(a.amount) FROM public.real_estate_banner_item_allocations a JOIN public.real_estate_banner_items i ON i.id=a.item_id WHERE i.request_id=v_request.id AND a.lot_id=cra.lot_id AND a.status IN ('refunded','expired')),0),
    status=CASE WHEN EXISTS(SELECT 1 FROM public.real_estate_banner_item_allocations a JOIN public.real_estate_banner_items i ON i.id=a.item_id WHERE i.request_id=v_request.id AND a.lot_id=cra.lot_id AND a.status='consumed') THEN 'consumed' ELSE 'cancelled' END,
    consumed_at=CASE WHEN v_consumed>0 THEN pg_catalog.now() ELSE NULL END,cancelled_at=CASE WHEN v_refunded>0 THEN pg_catalog.now() ELSE NULL END
   WHERE cra.reservation_id=v_request.reservation_id;
  v_balance:=public.sync_credit_balance_cache_from_lots(p_user_id);
  IF v_consumed>0 THEN INSERT INTO public.credit_transactions(user_id,tipo,creditos,saldo_resultante,observacao,metadata)
    VALUES(p_user_id,'consumo',-v_consumed,v_balance,'Banner Imobiliario entregue',pg_catalog.jsonb_build_object('product_code','real_estate_banner','request_id',v_request.id,'completed_count',v_completed,'failed_count',v_failed)); END IF;
  UPDATE public.credit_reservations SET status=CASE WHEN v_consumed>0 THEN 'consumed' ELSE 'cancelled' END,
    consumed_at=CASE WHEN v_consumed>0 THEN pg_catalog.now() ELSE NULL END,cancelled_at=CASE WHEN v_consumed=0 THEN pg_catalog.now() ELSE NULL END,
    metadata=metadata||pg_catalog.jsonb_build_object('partial_settlement',TRUE,'smart_tokens_consumed',v_consumed,'smart_tokens_refunded',v_refunded)
   WHERE id=v_request.reservation_id;
  UPDATE public.real_estate_banner_requests SET status=CASE WHEN v_completed>0 THEN 'completed' ELSE 'failed' END,completed_count=v_completed,failed_count=v_failed,
    smart_tokens_consumed=v_consumed,smart_tokens_refunded=v_refunded,completed_at=pg_catalog.now(),metadata=metadata||pg_catalog.jsonb_build_object('settled',TRUE)
   WHERE id=v_request.id RETURNING * INTO v_request;
  INSERT INTO public.economic_generation_events(user_id,reservation_id,product_code,variant,provider,quantity,usage,catalog_version,status,idempotency_key,metadata)
  VALUES(p_user_id,v_request.reservation_id,'real_estate_banner','batch','openai',v_request.item_count,'{}'::JSONB,v_request.catalog_version,
    CASE WHEN v_completed>0 THEN 'delivered' ELSE 'refunded' END,'real_estate_banner:batch:'||v_request.id,
    pg_catalog.jsonb_build_object('completed_count',v_completed,'failed_count',v_failed,'smart_tokens_reserved',v_request.smart_tokens_reserved,'smart_tokens_consumed',v_consumed,'smart_tokens_refunded',v_refunded))
  ON CONFLICT(idempotency_key) DO UPDATE SET status=EXCLUDED.status,metadata=EXCLUDED.metadata;
  INSERT INTO public.economic_generation_events(user_id,reservation_id,product_code,variant,provider,model,quantity,usage,catalog_version,status,idempotency_key,metadata)
  SELECT p_user_id,v_request.reservation_id,'real_estate_banner','item','openai',i.provider_model,1,i.provider_usage,v_request.catalog_version,
    CASE WHEN i.status='completed' THEN 'delivered' ELSE 'refunded' END,'real_estate_banner:item:'||i.id,
    pg_catalog.jsonb_build_object('request_id',v_request.id,'item_id',i.id,'format',i.format_id,'resolution',i.resolution,'quality',i.quality,'reference_count',i.reference_count,
      'response_id',i.provider_response_id,'attempt',i.attempt,'smart_tokens_reserved',75,'smart_tokens_consumed',CASE WHEN i.status='completed' THEN 75 ELSE 0 END,
      'smart_tokens_refunded',CASE WHEN i.status='failed' THEN 75 ELSE 0 END,'lot_slices',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('lot_id',a.lot_id,'amount',a.amount,'status',a.status)),'[]'::JSONB) FROM public.real_estate_banner_item_allocations a WHERE a.item_id=i.id))
  FROM public.real_estate_banner_items i WHERE i.request_id=v_request.id
  ON CONFLICT(idempotency_key) DO UPDATE SET status=EXCLUDED.status,usage=EXCLUDED.usage,metadata=EXCLUDED.metadata;
  RETURN NEXT v_request;
END; $$;

CREATE OR REPLACE FUNCTION public.fail_real_estate_banner_prepared_request(p_user_id UUID,p_client_request_id UUID,p_claim_token UUID,p_reason TEXT)
RETURNS TABLE(request_id UUID,request_status TEXT,returned_claim_token UUID,returned_reservation_id UUID,returned_item_count INTEGER,
  returned_quoted_tokens BIGINT,returned_reserved_tokens BIGINT,returned_items JSONB)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_request public.real_estate_banner_requests%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Nao autorizado' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_request FROM public.real_estate_banner_requests WHERE user_id=p_user_id AND client_request_id=p_client_request_id FOR UPDATE;
  IF NOT FOUND OR v_request.claim_token<>p_claim_token THEN RAISE EXCEPTION 'claim invalido'; END IF;
  UPDATE public.real_estate_banner_items SET status='failed',failed_at=pg_catalog.now(),result=pg_catalog.jsonb_build_object('reason',p_reason) WHERE request_id=v_request.id AND status IN ('pending','processing');
  IF v_request.reservation_id IS NULL THEN
    UPDATE public.real_estate_banner_requests SET status='failed',failed_count=item_count,failure_reason=p_reason,completed_at=pg_catalog.now() WHERE id=v_request.id RETURNING * INTO v_request;
  ELSE
    PERFORM public.settle_real_estate_banner_request(p_user_id,p_client_request_id); SELECT * INTO v_request FROM public.real_estate_banner_requests WHERE id=v_request.id;
  END IF;
  RETURN QUERY SELECT v_request.id,v_request.status,v_request.claim_token,v_request.reservation_id,v_request.item_count,v_request.smart_tokens_quoted,v_request.smart_tokens_reserved,
    COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(i) ORDER BY i.item_index) FROM public.real_estate_banner_items i WHERE i.request_id=v_request.id),'[]'::JSONB);
END; $$;

REVOKE EXECUTE ON FUNCTION public.claim_real_estate_banner_request(UUID,UUID,TEXT,INTEGER,INTEGER,JSONB) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.attach_real_estate_banner_reservation(UUID,UUID,UUID,UUID) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.begin_real_estate_banner_request(UUID,UUID,UUID) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_real_estate_banner_item(UUID,UUID,UUID,UUID) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.bind_real_estate_banner_generation(UUID,UUID,UUID) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.update_real_estate_banner_provider(UUID,UUID,TEXT,TEXT,JSONB) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.finalize_real_estate_banner_item(UUID,UUID,TEXT,JSONB,JSONB) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.settle_real_estate_banner_request(UUID,UUID) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.fail_real_estate_banner_prepared_request(UUID,UUID,UUID,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_real_estate_banner_request(UUID,UUID,TEXT,INTEGER,INTEGER,JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.attach_real_estate_banner_reservation(UUID,UUID,UUID,UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.begin_real_estate_banner_request(UUID,UUID,UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_real_estate_banner_item(UUID,UUID,UUID,UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.bind_real_estate_banner_generation(UUID,UUID,UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_real_estate_banner_provider(UUID,UUID,TEXT,TEXT,JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_real_estate_banner_item(UUID,UUID,TEXT,JSONB,JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_real_estate_banner_request(UUID,UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_real_estate_banner_prepared_request(UUID,UUID,UUID,TEXT) TO service_role;
