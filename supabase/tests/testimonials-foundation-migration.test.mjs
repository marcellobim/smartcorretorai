import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sql = readFileSync(new URL('../migrations/20260822010000_create_testimonials_foundation.sql', import.meta.url), 'utf8')

const functionStart = sql.indexOf('CREATE OR REPLACE FUNCTION public.approve_testimonial_and_grant_bonus')
const functionEnd = sql.indexOf('REVOKE ALL ON FUNCTION public.approve_testimonial_and_grant_bonus', functionStart)
const rpc = sql.slice(functionStart, functionEnd)
const signature = rpc.slice(0, rpc.indexOf('RETURNS TABLE'))

test('creates the private testimonial structure with constrained states and consent', () => {
  assert.match(sql, /CREATE TABLE public\.testimonials/)
  assert.match(sql, /user_id UUID NOT NULL REFERENCES auth\.users\(id\) ON DELETE CASCADE/)
  assert.match(sql, /bonus_adjustment_id UUID NULL UNIQUE[\s\S]*REFERENCES public\.admin_credit_adjustments\(id\)/)
  assert.match(sql, /pg_catalog\.length\(pg_catalog\.btrim\(body\)\) BETWEEN 1 AND 3000/)
  assert.match(sql, /profession_label IS NULL[\s\S]*BETWEEN 1 AND 120/)
  assert.match(sql, /status IN \('pending', 'approved', 'published', 'rejected'\)/)
  assert.match(sql, /status <> 'published'[\s\S]*publication_consent = TRUE[\s\S]*published_at IS NOT NULL[\s\S]*published_by IS NOT NULL/)
  assert.match(sql, /status <> 'rejected'[\s\S]*rejected_at IS NOT NULL[\s\S]*rejected_by IS NOT NULL[\s\S]*rejection_reason IS NOT NULL[\s\S]*pg_catalog\.length\(pg_catalog\.btrim\(rejection_reason\)\)/)
  assert.doesNotMatch(sql, /attribution_consent\s*=\s*TRUE[\s\S]*publication_consent\s*=\s*TRUE/)
})

test('keeps testimonial rows private and writable only by service_role', () => {
  assert.match(sql, /ALTER TABLE public\.testimonials ENABLE ROW LEVEL SECURITY/)
  assert.match(sql, /REVOKE ALL ON TABLE public\.testimonials FROM PUBLIC, anon, authenticated/)
  assert.match(sql, /GRANT ALL ON TABLE public\.testimonials TO service_role/)
  assert.doesNotMatch(sql, /CREATE POLICY[\s\S]*ON public\.testimonials/)
})

test('enforces one testimonial marketing lot per account in the canonical ledger', () => {
  assert.match(sql, /CREATE UNIQUE INDEX credit_lots_testimonial_marketing_one_per_user_idx[\s\S]*ON public\.credit_lots\(user_id\)[\s\S]*WHERE source = 'admin'[\s\S]*catalog_version = 'testimonial-marketing-v1'/)
})

test('RPC accepts no amount or user id and fixes the bonus at exactly 500 ST', () => {
  assert.match(signature, /p_testimonial_id UUID[\s\S]*p_admin_user_id UUID[\s\S]*p_idempotency_key UUID/)
  assert.doesNotMatch(signature, /p_(?:amount|user_id)/)
  assert.match(rpc, /v_testimonial\.user_id,[\s\S]*500,[\s\S]*v_reason,[\s\S]*p_idempotency_key/)
})

test('RPC is private, verifies admin_users and uses a safe SECURITY DEFINER search path', () => {
  assert.match(rpc, /SECURITY DEFINER[\s\S]*SET search_path = ''/)
  assert.match(rpc, /auth\.role\(\) IS DISTINCT FROM 'service_role'/)
  assert.match(rpc, /FROM public\.admin_users au WHERE au\.user_id = p_admin_user_id/)
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.approve_testimonial_and_grant_bonus\(UUID, UUID, UUID\)[\s\S]*FROM PUBLIC, anon, authenticated/)
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.approve_testimonial_and_grant_bonus\(UUID, UUID, UUID\)[\s\S]*TO service_role/)
})

test('RPC derives the account from the locked testimonial and serializes grants by profile', () => {
  assert.match(rpc, /FROM public\.testimonials t[\s\S]*t\.id = p_testimonial_id[\s\S]*FOR UPDATE/)
  assert.match(rpc, /FROM public\.profiles p[\s\S]*p\.id = v_testimonial\.user_id[\s\S]*FOR UPDATE/)
  assert.doesNotMatch(signature, /p_user_id/)
})

test('RPC reuses the existing audited grant and classifies the resulting lot as marketing', () => {
  assert.match(rpc, /FROM public\.grant_admin_credit_lot\(/)
  assert.doesNotMatch(rpc, /INSERT INTO public\.(?:credit_lots|admin_credit_adjustments)/)
  assert.match(rpc, /catalog_version = 'testimonial-marketing-v1'/)
  assert.match(rpc, /'grant_kind', 'marketing_testimonial'/)
  assert.match(rpc, /'campaign', 'testimonial-500-v1'/)
  assert.match(rpc, /'testimonial_id', v_testimonial\.id/)
  assert.match(rpc, /'admin_user_id', p_admin_user_id/)
  assert.match(rpc, /bonus_adjustment_id = v_adjustment_id/)
})

test('same testimonial retry and another testimonial from the account cannot grant again', () => {
  assert.match(rpc, /v_testimonial\.bonus_adjustment_id IS NOT NULL[\s\S]*'already_processed'/)
  assert.match(rpc, /cl\.user_id = v_testimonial\.user_id[\s\S]*cl\.catalog_version = 'testimonial-marketing-v1'[\s\S]*'bonus_already_granted'/)
  assert.match(rpc, /status = CASE WHEN t\.status = 'pending' THEN 'approved' ELSE t\.status END/)
})

test('idempotency cannot reclassify an unrelated manual adjustment', () => {
  assert.match(rpc, /FROM public\.admin_credit_adjustments aca[\s\S]*aca\.idempotency_key = p_idempotency_key[\s\S]*Conflito de idempotencia de depoimento/)
  assert.match(rpc, /v_grant_result IS DISTINCT FROM 'created'/)
})

test('all economic work stays in one function transaction and returns the confirmed balance', () => {
  assert.match(rpc, /g\.saldo_creditos[\s\S]*INTO v_grant_result, v_adjustment_id, v_credit_lot_id, v_balance/)
  assert.match(rpc, /RETURN QUERY SELECT[\s\S]*'created'::TEXT[\s\S]*v_adjustment_id[\s\S]*v_credit_lot_id[\s\S]*v_balance/)
  assert.doesNotMatch(rpc, /EXCEPTION\s+WHEN|COMMIT|ROLLBACK/i)
})

test('rejected testimonials cannot receive the marketing bonus', () => {
  assert.match(rpc, /v_testimonial\.status = 'rejected'[\s\S]*Depoimento rejeitado nao pode receber bonus/)
})
