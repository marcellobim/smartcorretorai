-- Persist immutable social caption snapshots for completed Smart Carousel deliveries
-- created before the shared Studio IA social contract was deployed.
UPDATE public.smart_carousel_economy_requests AS request
SET campaign_package = pg_catalog.jsonb_set(
  request.campaign_package,
  '{publication_options}',
  (
    SELECT pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', 'studio-caption-option-' || campaign.ordinality::TEXT,
        'label', 'Texto ' || campaign.ordinality::TEXT,
        'text', pg_catalog.btrim(pg_catalog.split_part(campaign.value->>'instagram', ' #', 1))
      )
      ORDER BY campaign.ordinality
    )
    FROM pg_catalog.jsonb_array_elements(request.campaign_package->'campaigns')
      WITH ORDINALITY AS campaign(value, ordinality)
  ),
  TRUE
),
updated_at = pg_catalog.now()
WHERE request.status = 'succeeded'
  AND pg_catalog.jsonb_typeof(request.campaign_package->'campaigns') = 'array'
  AND pg_catalog.jsonb_array_length(request.campaign_package->'campaigns') = 3
  AND COALESCE(pg_catalog.jsonb_typeof(request.campaign_package->'publication_options'), 'null') <> 'array';
