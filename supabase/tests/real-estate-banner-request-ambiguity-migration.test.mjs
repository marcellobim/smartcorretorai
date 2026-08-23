import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const original = readFileSync(path.resolve(here, '../migrations/20260817030000_create_real_estate_banner_economy.sql'), 'utf8').replaceAll('\r\n', '\n')
const correction = readFileSync(path.resolve(here, '../migrations/20260823010000_fix_real_estate_banner_request_ambiguity.sql'), 'utf8').replaceAll('\r\n', '\n')

const extractClaimRpc = source => source.match(/CREATE OR REPLACE FUNCTION public\.claim_real_estate_banner_request\([\s\S]*?END; \$\$;/)?.[0]

test('corrective migration changes only the ambiguous request_id reference', () => {
  const originalRpc = extractClaimRpc(original)
  const correctedRpc = extractClaimRpc(correction)
  assert.ok(originalRpc)
  assert.ok(correctedRpc)
  assert.match(correctedRpc, /FROM public\.real_estate_banner_items AS i WHERE i\.request_id=v_request\.id/)
  assert.doesNotMatch(correctedRpc, /FROM public\.real_estate_banner_items WHERE request_id=v_request\.id/)
  assert.equal(
    correctedRpc.replace('FROM public.real_estate_banner_items AS i WHERE i.request_id=v_request.id', 'FROM public.real_estate_banner_items WHERE request_id=v_request.id'),
    originalRpc,
  )
})

test('RPC signature, security boundary and service-role permissions remain explicit', () => {
  assert.match(correction, /RETURNS TABLE \(\s*request_id UUID, request_status TEXT, returned_claim_token UUID,/)
  assert.match(correction, /LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''/)
  assert.match(correction, /FOR UPDATE/)
  assert.match(correction, /ON CONFLICT\(user_id,product_code,client_request_id\) DO NOTHING/)
  assert.match(correction, /REVOKE EXECUTE[^;]+FROM PUBLIC,anon,authenticated;/)
  assert.match(correction, /GRANT EXECUTE[^;]+TO service_role;/)
})
