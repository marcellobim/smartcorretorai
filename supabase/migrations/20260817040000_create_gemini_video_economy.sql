-- Local-only foundation for the approved Gemini video family (325 ST each).
-- Depends on 20260816010000_create_credit_lots_foundation.sql and is not applied remotely here.

create table if not exists public.gemini_video_economy_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_request_id uuid not null,
  product_code text not null check (product_code in ('real_estate_video','short_videos','life_in_property','broker_presentation')),
  status text not null check (status in ('processing','completed','failed','insufficient')),
  reservation_id uuid references public.credit_reservations(id),
  idempotency_key text not null unique,
  smart_tokens_quoted bigint not null default 325 check (smart_tokens_quoted = 325),
  smart_tokens_reserved bigint not null default 0 check (smart_tokens_reserved in (0,325)),
  smart_tokens_consumed bigint not null default 0 check (smart_tokens_consumed in (0,325)),
  smart_tokens_refunded bigint not null default 0 check (smart_tokens_refunded in (0,325)),
  provider text not null default 'google' check (provider = 'google'),
  model text,
  provider_job_id text,
  catalog_version text not null,
  metadata jsonb not null default '{}'::jsonb,
  telemetry jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  failure_reason text,
  provider_started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, product_code, client_request_id),
  unique (user_id, client_request_id)
);

alter table public.gemini_video_economy_requests enable row level security;
revoke all on table public.gemini_video_economy_requests from public, anon, authenticated;
grant select, insert, update, delete on table public.gemini_video_economy_requests to service_role;

create or replace function public.claim_gemini_video_economy_request(
  p_user_id uuid,
  p_client_request_id uuid,
  p_product_code text,
  p_catalog_version text,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  request_id uuid,
  request_status text,
  execution_claimed boolean,
  required_tokens bigint,
  available_tokens bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.gemini_video_economy_requests%rowtype;
  v_balance bigint := 0;
  v_reservation_id uuid;
  v_key text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service_role_required'; end if;
  if p_user_id is null or p_client_request_id is null then raise exception 'invalid_economic_identity'; end if;
  if p_product_code not in ('real_estate_video','short_videos','life_in_property','broker_presentation') then raise exception 'invalid_gemini_video_product'; end if;
  if nullif(btrim(p_catalog_version), '') is null then raise exception 'invalid_catalog_version'; end if;

  v_key := p_product_code || ':' || p_user_id::text || ':' || p_client_request_id::text;
  insert into public.gemini_video_economy_requests (
    user_id, client_request_id, product_code, status, idempotency_key, catalog_version, metadata
  ) values (
    p_user_id, p_client_request_id, p_product_code, 'processing', v_key, p_catalog_version, coalesce(p_metadata, '{}'::jsonb)
  ) on conflict (user_id, client_request_id) do nothing;

  select * into v_request
  from public.gemini_video_economy_requests
  where user_id = p_user_id and client_request_id = p_client_request_id
  for update;

  if v_request.product_code <> p_product_code or v_request.catalog_version <> p_catalog_version then
    raise exception 'economic_request_identity_mismatch';
  end if;
  if v_request.status in ('completed','failed','insufficient') or v_request.reservation_id is not null then
    select coalesce(visible_balance, 0) into v_balance from public.get_credit_lot_balance(p_user_id);
    return query select v_request.id, v_request.status, false, 325::bigint, coalesce(v_balance, 0);
    return;
  end if;

  select coalesce(visible_balance, 0) into v_balance from public.get_credit_lot_balance(p_user_id);
  if v_balance < 325 then
    update public.gemini_video_economy_requests
    set status = 'insufficient', failure_reason = 'INSUFFICIENT_SMART_TOKENS', updated_at = now()
    where id = v_request.id;
    return query select v_request.id, 'insufficient'::text, false, 325::bigint, coalesce(v_balance, 0);
    return;
  end if;

  select id into v_reservation_id
  from public.reserve_credits_from_lots(p_user_id, 325, v_key, null, 'gemini_video_generation', jsonb_build_object(
    'product_code', p_product_code, 'client_request_id', p_client_request_id, 'catalog_version', p_catalog_version
  ));

  update public.gemini_video_economy_requests
  set reservation_id = v_reservation_id, smart_tokens_reserved = 325,
      provider_started_at = now(), updated_at = now()
  where id = v_request.id;
  return query select v_request.id, 'processing'::text, true, 325::bigint, v_balance;
end;
$$;

create or replace function public.update_gemini_video_economy_telemetry(
  p_user_id uuid,
  p_client_request_id uuid,
  p_provider_job_id text default null,
  p_model text default null,
  p_telemetry jsonb default '{}'::jsonb
)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service_role_required'; end if;
  update public.gemini_video_economy_requests
  set provider_job_id = coalesce(nullif(p_provider_job_id, ''), provider_job_id),
      model = coalesce(nullif(p_model, ''), model), telemetry = telemetry || coalesce(p_telemetry, '{}'::jsonb), updated_at = now()
  where user_id = p_user_id and client_request_id = p_client_request_id;
  -- Legacy video_jobs created before this local rollout have no economic row.
  if not found then return; end if;
end;
$$;

create or replace function public.settle_gemini_video_economy_request(
  p_user_id uuid,
  p_client_request_id uuid,
  p_final_status text,
  p_result jsonb default '{}'::jsonb,
  p_telemetry jsonb default '{}'::jsonb,
  p_reason text default null
)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_request public.gemini_video_economy_requests%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service_role_required'; end if;
  if p_final_status not in ('completed','failed') then raise exception 'invalid_economic_final_status'; end if;
  select * into v_request from public.gemini_video_economy_requests
  where user_id = p_user_id and client_request_id = p_client_request_id for update;
  if not found then raise exception 'gemini_video_economy_request_not_found'; end if;
  if v_request.status in ('completed','failed','insufficient') then return; end if;
  if v_request.reservation_id is null then raise exception 'gemini_video_reservation_missing'; end if;

  if p_final_status = 'completed' then
    perform public.consume_reserved_credits_from_lots(p_user_id, v_request.idempotency_key, 'gemini_video_completed', jsonb_build_object(
      'product_code', v_request.product_code, 'client_request_id', p_client_request_id, 'catalog_version', v_request.catalog_version
    ));
    update public.gemini_video_economy_requests set status = 'completed', smart_tokens_consumed = 325,
      result = coalesce(p_result, '{}'::jsonb), telemetry = telemetry || coalesce(p_telemetry, '{}'::jsonb),
      completed_at = now(), updated_at = now() where id = v_request.id;
  else
    perform public.cancel_credit_reservation_from_lots(p_user_id, v_request.idempotency_key, coalesce(nullif(p_reason, ''), 'gemini_video_failed'));
    update public.gemini_video_economy_requests set status = 'failed', smart_tokens_refunded = 325,
      failure_reason = left(coalesce(nullif(p_reason, ''), 'gemini_video_failed'), 240),
      result = coalesce(p_result, '{}'::jsonb), telemetry = telemetry || coalesce(p_telemetry, '{}'::jsonb),
      failed_at = now(), updated_at = now() where id = v_request.id;
  end if;
end;
$$;

revoke all on function public.claim_gemini_video_economy_request(uuid, uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.update_gemini_video_economy_telemetry(uuid, uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.settle_gemini_video_economy_request(uuid, uuid, text, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.claim_gemini_video_economy_request(uuid, uuid, text, text, jsonb) to service_role;
grant execute on function public.update_gemini_video_economy_telemetry(uuid, uuid, text, text, jsonb) to service_role;
grant execute on function public.settle_gemini_video_economy_request(uuid, uuid, text, jsonb, jsonb, text) to service_role;
