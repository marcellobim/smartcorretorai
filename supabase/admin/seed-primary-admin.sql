-- Controlled provisioning for the primary administrator identified in the
-- read-only account audit. Authorization is bound only to auth.users.id.
-- Apply in the same reviewed rollout as the Admin P0 migration, before deploy.

BEGIN;

INSERT INTO public.admin_users (user_id, created_by)
VALUES (
  '653b5a06-9b7a-4009-9a8c-6e3ea701460c'::UUID,
  '653b5a06-9b7a-4009-9a8c-6e3ea701460c'::UUID
)
ON CONFLICT (user_id) DO NOTHING;

COMMIT;
