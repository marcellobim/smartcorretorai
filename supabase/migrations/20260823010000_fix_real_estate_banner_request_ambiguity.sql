-- Qualify the banner item request_id inside the TABLE-returning RPC so
-- PostgreSQL does not confuse it with the request_id output parameter.

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

  IF NOT EXISTS(SELECT 1 FROM public.real_estate_banner_items AS i WHERE i.request_id=v_request.id) THEN
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

REVOKE EXECUTE ON FUNCTION public.claim_real_estate_banner_request(UUID,UUID,TEXT,INTEGER,INTEGER,JSONB) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_real_estate_banner_request(UUID,UUID,TEXT,INTEGER,INTEGER,JSONB) TO service_role;
