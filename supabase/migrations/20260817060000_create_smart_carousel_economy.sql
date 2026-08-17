-- Local-only economic contract for Smart Carrossel: one 5-20 image delivery costs 100 ST.
-- Depends on 20260816010000_create_credit_lots_foundation.sql. Do not apply remotely in this task.

create table if not exists public.smart_carousel_economy_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_request_id uuid not null,
  product_code text not null default 'smart_carousel' check (product_code = 'smart_carousel'),
  image_count integer not null check (image_count between 5 and 20),
  status text not null check (status in ('processing','succeeded','failed','insufficient')),
  execution_claimed_at timestamptz,
  reservation_id uuid references public.credit_reservations(id),
  idempotency_key text not null unique,
  smart_tokens_quoted bigint not null default 100 check (smart_tokens_quoted = 100),
  smart_tokens_reserved bigint not null default 0 check (smart_tokens_reserved in (0,100)),
  smart_tokens_consumed bigint not null default 0 check (smart_tokens_consumed in (0,100)),
  smart_tokens_refunded bigint not null default 0 check (smart_tokens_refunded in (0,100)),
  primary_provider text not null default 'creatomate' check (primary_provider = 'creatomate'),
  openai_model text not null default 'gpt-4.1' check (openai_model = 'gpt-4.1'),
  tts_model text not null default 'tts-1' check (tts_model = 'tts-1'),
  creatomate_template text,
  render_id text,
  receipt text,
  campaign_package jsonb not null default '{}'::jsonb,
  video_url text,
  catalog_version text not null,
  metadata jsonb not null default '{}'::jsonb,
  telemetry jsonb not null default '{}'::jsonb,
  failure_reason text,
  provider_started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_request_id)
);

alter table public.smart_carousel_economy_requests enable row level security;
revoke all on table public.smart_carousel_economy_requests from public, anon, authenticated;
grant select, insert, update, delete on table public.smart_carousel_economy_requests to service_role;

create or replace function public.claim_smart_carousel_economy_request(
  p_user_id uuid, p_client_request_id uuid, p_image_count integer,
  p_catalog_version text, p_metadata jsonb default '{}'::jsonb
)
returns table (
  request_id uuid, request_status text, execution_claimed boolean,
  required_tokens bigint, available_tokens bigint, reservation_id uuid, idempotency_key text
)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_request public.smart_carousel_economy_requests%rowtype;
  v_balance bigint := 0;
  v_reservation_id uuid;
  v_key text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service_role_required'; end if;
  if p_user_id is null or p_client_request_id is null then raise exception 'invalid_economic_identity'; end if;
  if p_image_count < 5 or p_image_count > 20 then raise exception 'invalid_smart_carousel_image_count'; end if;
  if nullif(btrim(p_catalog_version), '') is null then raise exception 'invalid_catalog_version'; end if;

  v_key := 'smart_carousel:' || p_user_id::text || ':' || p_client_request_id::text;
  insert into public.smart_carousel_economy_requests (
    user_id, client_request_id, image_count, status, idempotency_key, catalog_version, metadata
  ) values (
    p_user_id, p_client_request_id, p_image_count, 'processing', v_key, p_catalog_version, coalesce(p_metadata, '{}'::jsonb)
  ) on conflict (user_id, client_request_id) do nothing;

  select * into v_request from public.smart_carousel_economy_requests
  where user_id = p_user_id and client_request_id = p_client_request_id for update;
  if v_request.image_count <> p_image_count or v_request.catalog_version <> p_catalog_version then
    raise exception 'economic_request_identity_mismatch';
  end if;

  select coalesce(visible_balance, 0) into v_balance from public.get_credit_lot_balance(p_user_id);
  if v_request.status in ('succeeded','failed','insufficient') or v_request.execution_claimed_at is not null then
    return query select v_request.id, v_request.status, false, 100::bigint, coalesce(v_balance, 0),
      v_request.reservation_id, v_request.idempotency_key;
    return;
  end if;
  if v_balance < 100 then
    update public.smart_carousel_economy_requests set status = 'insufficient',
      failure_reason = 'INSUFFICIENT_SMART_TOKENS', updated_at = now() where id = v_request.id;
    return query select v_request.id, 'insufficient'::text, false, 100::bigint, coalesce(v_balance, 0),
      null::uuid, v_request.idempotency_key;
    return;
  end if;

  select id into v_reservation_id from public.reserve_credits_from_lots(
    p_user_id, 100, v_key, null, 'smart_carousel_generation', jsonb_build_object(
      'product_code', 'smart_carousel', 'client_request_id', p_client_request_id,
      'image_count', p_image_count, 'catalog_version', p_catalog_version
    )
  );
  update public.smart_carousel_economy_requests set reservation_id = v_reservation_id,
    smart_tokens_reserved = 100, execution_claimed_at = now(), provider_started_at = now(), updated_at = now()
  where id = v_request.id;
  return query select v_request.id, 'processing'::text, true, 100::bigint, v_balance,
    v_reservation_id, v_request.idempotency_key;
end;
$$;

create or replace function public.get_smart_carousel_economy_request(p_user_id uuid, p_client_request_id uuid)
returns table (request_status text, render_id text, receipt text, campaign_package jsonb, video_url text, provider_started_at timestamptz)
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service_role_required'; end if;
  return query select r.status, r.render_id, r.receipt, r.campaign_package, r.video_url, r.provider_started_at
  from public.smart_carousel_economy_requests r
  where r.user_id = p_user_id and r.client_request_id = p_client_request_id;
end;
$$;

create or replace function public.record_smart_carousel_provider_request(
  p_user_id uuid, p_client_request_id uuid, p_render_id text, p_receipt text,
  p_campaign_package jsonb, p_telemetry jsonb default '{}'::jsonb
)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service_role_required'; end if;
  if nullif(btrim(p_render_id), '') is null or nullif(btrim(p_receipt), '') is null then raise exception 'invalid_provider_identity'; end if;
  update public.smart_carousel_economy_requests set render_id = p_render_id, receipt = p_receipt,
    campaign_package = coalesce(p_campaign_package, '{}'::jsonb), telemetry = telemetry || coalesce(p_telemetry, '{}'::jsonb),
    updated_at = now() where user_id = p_user_id and client_request_id = p_client_request_id and status = 'processing';
  if not found then raise exception 'smart_carousel_request_not_processing'; end if;
end;
$$;

create or replace function public.settle_smart_carousel_economy_request(
  p_user_id uuid, p_client_request_id uuid, p_final_status text, p_video_url text default null,
  p_reason text default null, p_telemetry jsonb default '{}'::jsonb
)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_request public.smart_carousel_economy_requests%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service_role_required'; end if;
  if p_final_status not in ('succeeded','failed') then raise exception 'invalid_economic_final_status'; end if;
  select * into v_request from public.smart_carousel_economy_requests
  where user_id = p_user_id and client_request_id = p_client_request_id for update;
  if not found then raise exception 'smart_carousel_economy_request_not_found'; end if;
  if v_request.status in ('succeeded','failed','insufficient') then return; end if;

  if p_final_status = 'succeeded' then
    if nullif(btrim(p_video_url), '') is null or p_video_url !~ '^https://' then raise exception 'deliverable_video_required'; end if;
    if v_request.render_id is null or v_request.reservation_id is null then raise exception 'smart_carousel_delivery_not_persisted'; end if;
    perform public.consume_reserved_credits_from_lots(p_user_id, v_request.idempotency_key, 'smart_carousel_completed', jsonb_build_object(
      'product_code', 'smart_carousel', 'client_request_id', p_client_request_id,
      'image_count', v_request.image_count, 'catalog_version', v_request.catalog_version
    ));
    update public.smart_carousel_economy_requests set status = 'succeeded', video_url = p_video_url,
      smart_tokens_consumed = 100, telemetry = telemetry || coalesce(p_telemetry, '{}'::jsonb),
      completed_at = now(), updated_at = now() where id = v_request.id;
  else
    if v_request.reservation_id is not null then
      perform public.cancel_credit_reservation_from_lots(p_user_id, v_request.idempotency_key,
        coalesce(nullif(p_reason, ''), 'smart_carousel_failed'));
    end if;
    update public.smart_carousel_economy_requests set status = 'failed',
      smart_tokens_refunded = case when reservation_id is null then 0 else 100 end,
      failure_reason = left(coalesce(nullif(p_reason, ''), 'smart_carousel_failed'), 240),
      telemetry = telemetry || coalesce(p_telemetry, '{}'::jsonb), failed_at = now(), updated_at = now()
    where id = v_request.id;
  end if;
end;
$$;

revoke all on function public.claim_smart_carousel_economy_request(uuid, uuid, integer, text, jsonb) from public, anon, authenticated;
revoke all on function public.get_smart_carousel_economy_request(uuid, uuid) from public, anon, authenticated;
revoke all on function public.record_smart_carousel_provider_request(uuid, uuid, text, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.settle_smart_carousel_economy_request(uuid, uuid, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.claim_smart_carousel_economy_request(uuid, uuid, integer, text, jsonb) to service_role;
grant execute on function public.get_smart_carousel_economy_request(uuid, uuid) to service_role;
grant execute on function public.record_smart_carousel_provider_request(uuid, uuid, text, text, jsonb, jsonb) to service_role;
grant execute on function public.settle_smart_carousel_economy_request(uuid, uuid, text, text, text, jsonb) to service_role;
