-- The delivery item stores its terminal render state in `status`.
-- Keep the telemetry key `render_status`, but source it from the real column.
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
      'render_id',i.render_id,'render_status',i.status,'smart_tokens_reserved',CASE WHEN v_request.admin_bypass THEN 0 ELSE i.unit_cost END,
      'smart_tokens_consumed',CASE WHEN NOT v_request.admin_bypass AND i.status='completed' THEN i.unit_cost ELSE 0 END,
      'smart_tokens_refunded',CASE WHEN NOT v_request.admin_bypass AND i.status='failed' THEN i.unit_cost ELSE 0 END,
      'lot_slices',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('lot_id',a.lot_id,'amount',a.amount,'status',a.status) ORDER BY a.created_at,a.lot_id),'[]'::jsonb) FROM public.quick_banner_item_allocations a WHERE a.item_id=i.id)
    )
  FROM public.quick_banner_delivery_items i WHERE i.request_id=v_request.id
  ON CONFLICT(idempotency_key) DO UPDATE SET status=EXCLUDED.status,usage=EXCLUDED.usage,metadata=EXCLUDED.metadata;
  RETURN NEXT v_request;
END; $$;
REVOKE EXECUTE ON FUNCTION public.settle_quick_banner_delivery(UUID,UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.settle_quick_banner_delivery(UUID,UUID) TO service_role;
