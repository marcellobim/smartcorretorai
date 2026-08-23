\set ON_ERROR_STOP on
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', false);
SELECT request_id,request_status,returned_item_count
FROM public.claim_real_estate_banner_request(
  '10000000-0000-0000-0000-000000000004',
  '20000000-0000-0000-0000-000000000004',
  'test-v1',1,1,
  '[{"piece_id":"feed-4","format_id":"instagram_feed","format_group":"square_feed","creation_option":1,"resolution":"1024x1024","reference_count":0,"retry_of_item_id":null,"unit_cost":75}]'::jsonb
);
