-- Smart Space: remove the obsolete fixed 30 ST quote constraint.
-- Forward-only and intentionally data preserving.

DO $migration$
DECLARE
  v_legacy_definition TEXT;
  v_dynamic_definition TEXT;
BEGIN
  LOCK TABLE public.virtual_staging_image_requests IN ACCESS EXCLUSIVE MODE;
  LOCK TABLE public.virtual_staging_image_items IN ACCESS EXCLUSIVE MODE;
  LOCK TABLE public.credit_reservations IN SHARE MODE;

  SELECT pg_catalog.pg_get_constraintdef(c.oid)
    INTO v_legacy_definition
  FROM pg_catalog.pg_constraint c
  WHERE c.conrelid = 'public.virtual_staging_image_requests'::pg_catalog.regclass
    AND c.conname = 'virtual_staging_image_requests_check';

  IF v_legacy_definition IS DISTINCT FROM
    'CHECK ((smart_tokens_quoted = (image_count * 30)))' THEN
    RAISE EXCEPTION 'unexpected legacy Smart Space quote constraint: %',
      COALESCE(v_legacy_definition, '<missing>');
  END IF;

  SELECT pg_catalog.pg_get_constraintdef(c.oid)
    INTO v_dynamic_definition
  FROM pg_catalog.pg_constraint c
  WHERE c.conrelid = 'public.virtual_staging_image_requests'::pg_catalog.regclass
    AND c.conname = 'virtual_staging_image_requests_smart_tokens_quoted_check';

  IF v_dynamic_definition IS DISTINCT FROM
    'CHECK ((smart_tokens_quoted = (image_count * unit_cost)))' THEN
    RAISE EXCEPTION 'unexpected dynamic Smart Space quote constraint: %',
      COALESCE(v_dynamic_definition, '<missing>');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint c
    WHERE c.conrelid = 'public.virtual_staging_image_requests'::pg_catalog.regclass
      AND c.conname = 'virtual_staging_image_requests_unit_cost_check'
      AND pg_catalog.pg_get_constraintdef(c.oid) =
        'CHECK ((unit_cost = ANY (ARRAY[(30)::bigint, (60)::bigint])))'
  ) THEN
    RAISE EXCEPTION 'unexpected Smart Space unit_cost constraint';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.virtual_staging_image_requests
    WHERE status IN ('pending', 'preparing', 'processing')
  ) OR EXISTS (
    SELECT 1 FROM public.virtual_staging_image_items
    WHERE status IN ('pending', 'preparing', 'processing')
  ) THEN
    RAISE EXCEPTION 'active Smart Space work prevents constraint migration';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.credit_reservations cr
    JOIN public.virtual_staging_image_requests r ON r.reservation_id = cr.id
    WHERE cr.status IN ('open', 'pending', 'reserved')
  ) THEN
    RAISE EXCEPTION 'open Smart Space reservation prevents constraint migration';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.virtual_staging_image_requests
    WHERE unit_cost NOT IN (30, 60)
       OR smart_tokens_quoted <> image_count * unit_cost
  ) THEN
    RAISE EXCEPTION 'incompatible Smart Space history prevents constraint migration';
  END IF;

  ALTER TABLE public.virtual_staging_image_requests
    DROP CONSTRAINT virtual_staging_image_requests_check;
END;
$migration$;
