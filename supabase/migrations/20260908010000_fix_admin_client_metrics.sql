-- Admin client metrics must distinguish a real RPC/schema failure from a
-- successful aggregate with no matching economic or generation rows.

CREATE OR REPLACE FUNCTION public.admin_client_credit_metrics(p_user_ids UUID[])
RETURNS TABLE (
  user_id UUID,
  subscription_granted BIGINT,
  purchase_granted BIGINT,
  admin_granted BIGINT,
  purchase_remaining BIGINT,
  purchase_count BIGINT,
  purchase_catalog_cents BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH requested_users AS (
    SELECT DISTINCT requested.user_id
    FROM pg_catalog.unnest(COALESCE(p_user_ids, ARRAY[]::UUID[])) AS requested(user_id)
    WHERE requested.user_id IS NOT NULL
  )
  SELECT requested.user_id,
    COALESCE(SUM(lot.original_amount) FILTER (WHERE lot.source = 'subscription'), 0)::BIGINT,
    COALESCE(SUM(lot.original_amount) FILTER (WHERE lot.source = 'purchase'), 0)::BIGINT,
    COALESCE(SUM(lot.original_amount) FILTER (WHERE lot.source = 'admin'), 0)::BIGINT,
    COALESCE(SUM(lot.remaining_amount) FILTER (
      WHERE lot.source = 'purchase'
        AND lot.status = 'active'
        AND (lot.expires_at IS NULL OR lot.expires_at > pg_catalog.now())
    ), 0)::BIGINT,
    COUNT(lot.id) FILTER (WHERE lot.source = 'purchase')::BIGINT,
    CASE
      WHEN COUNT(lot.id) FILTER (
        WHERE lot.source = 'purchase' AND lot.original_amount NOT IN (2000, 4000)
      ) > 0 THEN NULL
      ELSE (
        COUNT(lot.id) FILTER (WHERE lot.source = 'purchase' AND lot.original_amount = 2000) * 4990
        + COUNT(lot.id) FILTER (WHERE lot.source = 'purchase' AND lot.original_amount = 4000) * 9790
      )::BIGINT
    END
  FROM requested_users requested
  LEFT JOIN public.credit_lots lot ON lot.user_id = requested.user_id
  WHERE auth.role() = 'service_role'
  GROUP BY requested.user_id;
$$;

CREATE OR REPLACE FUNCTION public.admin_client_activity_metrics(p_user_ids UUID[])
RETURNS TABLE (
  user_id UUID,
  generations BIGINT,
  failures BIGINT,
  last_generation_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH requested_users AS (
    SELECT DISTINCT requested.user_id
    FROM pg_catalog.unnest(COALESCE(p_user_ids, ARRAY[]::UUID[])) AS requested(user_id)
    WHERE requested.user_id IS NOT NULL
  ), terminal_activity AS (
    SELECT request.user_id, request.status, request.completed_at AS occurred_at
    FROM public.gemini_video_economy_requests request
    WHERE request.user_id = ANY(p_user_ids) AND request.status IN ('completed', 'failed')

    UNION ALL
    SELECT request.user_id, request.status, request.completed_at
    FROM public.veo_video_economy_requests request
    WHERE request.user_id = ANY(p_user_ids) AND request.status IN ('completed', 'failed')

    UNION ALL
    SELECT request.user_id, request.status, request.completed_at
    FROM public.text_campaign_delivery_requests request
    WHERE request.user_id = ANY(p_user_ids) AND request.status IN ('completed', 'failed')

    UNION ALL
    SELECT request.user_id,
      CASE request.status WHEN 'succeeded' THEN 'completed' ELSE request.status END,
      request.completed_at
    FROM public.smart_carousel_economy_requests request
    WHERE request.user_id = ANY(p_user_ids) AND request.status IN ('succeeded', 'failed')

    UNION ALL
    SELECT request.user_id, item.status, item.completed_at
    FROM public.real_estate_banner_items item
    JOIN public.real_estate_banner_requests request ON request.id = item.request_id
    WHERE request.user_id = ANY(p_user_ids) AND item.status IN ('completed', 'failed')

    UNION ALL
    SELECT request.user_id, item.status, item.completed_at
    FROM public.quick_banner_delivery_items item
    JOIN public.quick_banner_delivery_requests request ON request.id = item.request_id
    WHERE request.user_id = ANY(p_user_ids) AND item.status IN ('completed', 'failed')

    UNION ALL
    SELECT request.user_id, item.status, item.completed_at
    FROM public.virtual_staging_image_items item
    JOIN public.virtual_staging_image_requests request ON request.id = item.request_id
    WHERE request.user_id = ANY(p_user_ids) AND item.status IN ('completed', 'failed')

    UNION ALL
    SELECT request.user_id, request.status, request.completed_at
    FROM public.listing_xray_requests request
    WHERE request.user_id = ANY(p_user_ids) AND request.status IN ('completed', 'failed')
  )
  SELECT requested.user_id,
    COUNT(activity.user_id) FILTER (WHERE activity.status = 'completed')::BIGINT,
    COUNT(activity.user_id) FILTER (WHERE activity.status = 'failed')::BIGINT,
    MAX(activity.occurred_at) FILTER (WHERE activity.status = 'completed')
  FROM requested_users requested
  LEFT JOIN terminal_activity activity ON activity.user_id = requested.user_id
  WHERE auth.role() = 'service_role'
  GROUP BY requested.user_id;
$$;

REVOKE ALL ON FUNCTION public.admin_client_credit_metrics(UUID[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_client_activity_metrics(UUID[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_client_credit_metrics(UUID[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_client_activity_metrics(UUID[]) TO service_role;
