-- Close only the three no-charge/no-render admin requests identified on
-- 2026-08-27. A replay after all three are closed is a no-op; any partial or
-- expanded match aborts the migration before changing data.
DO $$
DECLARE
  v_request_ids UUID[];
  v_request_count INTEGER;
  v_item_count INTEGER;
BEGIN
  SELECT pg_catalog.array_agg(r.id ORDER BY r.id), pg_catalog.count(*)
    INTO v_request_ids, v_request_count
    FROM public.quick_banner_delivery_requests r
   WHERE r.admin_bypass = TRUE
     AND r.status = 'preparing'
     AND r.campaign_generation_status = 'pending'
     AND r.reservation_id IS NULL
     AND r.smart_tokens_reserved = 0
     AND r.smart_tokens_consumed = 0
     AND r.smart_tokens_refunded = 0
     AND (
       r.id::TEXT LIKE '5671319b-%' OR r.client_request_id::TEXT LIKE '5671319b-%'
       OR r.id::TEXT LIKE 'd05cc9fd-%' OR r.client_request_id::TEXT LIKE 'd05cc9fd-%'
       OR r.id::TEXT LIKE 'b62b5383-%' OR r.client_request_id::TEXT LIKE 'b62b5383-%'
     )
     AND (SELECT pg_catalog.count(*) FROM public.quick_banner_delivery_items i WHERE i.request_id = r.id) = 5
     AND NOT EXISTS (
       SELECT 1
         FROM public.quick_banner_delivery_items i
        WHERE i.request_id = r.id
          AND (i.status <> 'pending' OR i.render_id IS NOT NULL)
     );

  IF v_request_count = 0 THEN
    RETURN;
  END IF;
  IF v_request_count <> 3 THEN
    RAISE EXCEPTION 'quick_banner_orphan_cleanup_expected_3_found_%', v_request_count;
  END IF;

  UPDATE public.quick_banner_delivery_items
     SET status = 'failed',
         failed_at = pg_catalog.now(),
         result = pg_catalog.jsonb_build_object('reason', 'admin_bypass_campaign_gate_orphan_closed')
   WHERE request_id = ANY(v_request_ids)
     AND status = 'pending'
     AND render_id IS NULL;
  GET DIAGNOSTICS v_item_count = ROW_COUNT;
  IF v_item_count <> 15 THEN
    RAISE EXCEPTION 'quick_banner_orphan_cleanup_expected_15_items_found_%', v_item_count;
  END IF;

  UPDATE public.quick_banner_delivery_requests
     SET status = 'failed',
         failed_count = item_count,
         failure_reason = 'admin_bypass_campaign_gate_orphan_closed',
         completed_at = pg_catalog.now()
   WHERE id = ANY(v_request_ids)
     AND status = 'preparing';
  GET DIAGNOSTICS v_request_count = ROW_COUNT;
  IF v_request_count <> 3 THEN
    RAISE EXCEPTION 'quick_banner_orphan_cleanup_update_expected_3_found_%', v_request_count;
  END IF;
END;
$$;
