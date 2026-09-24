> Historical Phase A Studio contract. Current Video Imobiliario endpoint and product mapping: [Parte 1](tiktok-video-imobiliario-direct-post.md).

# TikTok Direct Post Comercial — Phase A

Status: FILE_UPLOAD candidate prepared locally. Phase A and OAuth Upgrade were validated in the isolated PostgreSQL 17.6 laboratory during earlier authorized checkpoints. No production rollout or real Content Posting invocation is part of this candidate.

## Decision and boundaries

Sandbox, Admin/MFA, studio_ia_commercial, finalized MP4, Direct Post FILE_UPLOAD, at most 52,428,800 bytes.
No inbox/draft, video.upload, photos, PULL_FROM_URL, custom domain, DNS or Cloudflare.
Preserve the original Login Kit migration and Basic contract. The separate Admin-only OAuth upgrade requests user.info.basic + video.publish; see tiktok-direct-post-oauth-upgrade.md. No secrets are included.
The migration allows preparing a job with the existing connection but blocks initializing until both scopes and adequate token lifetime exist.

TikTok officially directs server-hosted media to PULL_FROM_URL. FILE_UPLOAD here follows the explicit first-homologation decision; this does not establish provider policy approval or public-review readiness.
References:
- https://developers.tiktok.com/docs/en/content-posting-api-reference-direct-post
- https://developers.tiktok.com/docs/en/content-posting-api-media-transfer-guide
- https://developers.tiktok.com/docs/en/content-sharing-guidelines

## Server trust boundaries

Future control endpoints MUST call createJobFromControl or the same authorization gate before any operation:
1. auth.getUser(jwt), never trusting decoded client claims alone.
2. Existing requireAuthorizedAdmin against admin_users.
3. Existing requireAdminAal2.
4. Server-loaded active environment sandbox and app identity from the existing trusted configuration.
5. Owner-scoped connection and creation.
No endpoint is created by Phase A. Internal helpers are not independently authenticated public handlers.

Client input allows only creation_id, connection_id, idempotency_key and confirmed_options.
Creator info, timestamp, user, environment, app, bucket, object path and probe results come from trusted backend adapters.
Unknown input fields fail closed.
No caller-provided URL or bucket/path is accepted.

Creation is video_jobs.id; it must belong to the authenticated user, be completed, mode dynamic_reel,
and output_video_path must equal user_id/creation_id/video.mp4.
source_type studio_ia_commercial is derived server-side from this supported product mapping.
Do not assume video_jobs contains a source_type column.

## Media preflight and probe

Storage inspection requires object existence, video/mp4, exact positive byte length <= 50 MiB, ETag/version where available.
The probe adapter must inspect real object bytes and return MP4 container, h264/hevc video codec, dimensions 360..4096,
duration >0 and <=600000ms, fps 23..60, byte length, ETag/version and SHA-256 of the complete file.
Duration must also fit current creator_info max_video_post_duration_sec.
Missing or inconsistent probe data blocks job creation. No fallback to generator parameters.

The implemented mp4-probe.ts inspects bounded MP4 bytes locally without URLs or network,
validates structural sample bounds, codec configuration, dimensions, duration and FPS,
and hashes the complete payload. It does not decode frames or claim ffprobe equivalence.
Tests include synthetic containers and a previously authorized real Commercial Imobiliario
MP4 read-only proof. Hosted Edge execution limits still require independent validation.

Before init, the local FILE_UPLOAD coordinator loads the same authorized object, checks length and SHA-256,
and rejects replacement before invoking TikTok. The Phase A mock client uses a bounded Uint8Array (<=50 MiB).
This is NOT a proof that a real Edge worker can complete download/probe/upload within CPU/memory/wall limits.
Execution placement must be decided and tested before a deployable function is introduced.

## Job schema

New migration: 20260923010000_create_tiktok_publish_jobs.sql.
Identity: UUID id/user/connection/creation, sandbox, app digest, internal connection_open_id.
The additional open_id permits the existing Login Kit composite identity FK without altering its table.
Product and bucket are fixed. Object path is constrained to user/creation/video.mp4.
Media includes ETag, version, SHA-256, MIME, length, width, height, duration and codec.
Intent includes UUID idempotency key, backend canonical SHA-256 fingerprint.
Consent includes projected options, projected creator constraints, checked/confirmed timestamps, consent version.
Execution includes publish id, internal/provider states, provider_post_ids, attempt counters, revision,
claim token/deadline, poll/init/upload timestamps, sanitized error enum and terminal completion timestamp.

No columns for tokens, upload URL, signed Storage URL or client secret.
JSON keys are restricted; creator snapshot intentionally stores only constraints, not arbitrary provider responses.
Free-form caption is user content; callers must never populate it with credentials.
Snapshot fields are immutable from creation, stronger than the required freeze after start.

Idempotency is unique by user/environment/app/key. Same fingerprint returns the existing job.
Different fingerprint with the same key is rejected.
Fingerprint excludes volatile timestamps; includes owner/connection/app/product/creation/media digest/options/consent version.
Creation RPC serializes same-key requests with transaction advisory lock.
Active-job partial unique index excludes only published/blocked/failed, so reconciliation still blocks another active job.
publish_id has environment/app uniqueness.
No automatic new job after ambiguous provider outcome.

## State machine and CAS

awaiting_confirmation -> queued | blocked
queued -> initializing | blocked
initializing -> uploading | failed | reconciliation_required
uploading -> processing | failed | reconciliation_required
processing -> processing | published | failed | reconciliation_required
reconciliation_required -> processing | published | failed (only with publish_id)
published, blocked, failed -> no outgoing transition

The create RPC receives already-confirmed options but first creates awaiting_confirmation;
the subsequent queued transition acknowledges the durable confirmation before starting execution.
No public direct transitions are granted.

claim_tiktok_publish_job: expected revision, row lock, 120-second lease, generated claim token.
Live claims cannot be stolen. Claiming an expired initializing/uploading job changes it to reconciliation_required,
never reinitializes. claim/transition use NULL-safe expected revision comparison.
transition_tiktok_publish_job requires exact revision, token and unexpired lease.
No lease renewal or unattended worker is implemented in Phase A.

Only one init and one upload attempt are permitted by this first contract.
init requires a still-authorized Admin, active matching connection, both scopes, token lifetime >2 minutes,
and creator info checked within 5 minutes. Creator UI reconfirmation is needed when stale; no silent option changes.
published requires PUBLISH_COMPLETE. failed requires authoritative FAILED.
provider_post_ids is reserved with empty default; population/status-fetch adapter is a later additive checkpoint.
No recovery of missing upload URLs by re-init is permitted.

## FILE_UPLOAD

Single chunk for every accepted file in this first round:
source FILE_UPLOAD, video_size=N, chunk_size=N, total_chunk_count=1.
Limit 50 MiB is below TikTok's documented 64 MB chunk ceiling; sub-5 MB files are sent whole.
Direct Post init uses /v2/post/publish/video/init/ with video.publish, not the inbox endpoint.

Init request timeout: 20 seconds; redirects rejected; fetch is mandatory dependency injection (no default network).
Success requires HTTP success AND error.code=ok.
publish_id is constrained to the documented 64-character bound.
upload_url is only held in local memory and is never passed to the repository or returned by the coordinator.
Exact allowlisted HTTPS hosts: open-upload.tiktokapis.com and upload.us.tiktokapis.com.
Allowed paths: /video/ and /upload/; upload_id/upload_token required; no credentials, fragment or non-default port.
Unknown regional destinations fail closed pending explicit contract review, not wildcard expansion.

After init, persist publish_id through CAS and await database ACK BEFORE PUT.
Upload request: Content-Type video/mp4, Content-Length N, Content-Range bytes 0-(N-1)/N.
No TikTok bearer token is forwarded to the upload host.
PUT timeout: 60 seconds; single-chunk completion requires 201.
Both request bodies and provider responses must be excluded from logs.

Ambiguous init: reconciliation_required, no retry.
Known publish id but invalid upload URL: persist id and enter reconciliation, no upload.
Failure to ACK publish_id persistence: stop before PUT; expired lease enters reconciliation.
If the id was never durable and process memory is lost, manual reconciliation may be required; there is no false exactly-once guarantee.
Ambiguous PUT: retain publish_id, reconcile with status before any future retry.
Upload URL loss after crash: no blind re-init. Phase A intentionally does not retry PUT.
Provider error bodies are never exposed; conservative failure classification may require manual reconciliation.

## Database permissions

RLS enabled; no policies for anon/authenticated.
Explicit REVOKE ALL for PUBLIC, anon, authenticated and service_role.
service_role receives SELECT on the table and EXECUTE only on create/claim/transition RPCs.
No direct INSERT/UPDATE/DELETE/TRUNCATE/TRIGGER/REFERENCES grants.
Definer RPCs have safe search_path and qualified application relations.
Original Login Kit relations/functions/grants are not modified.
Administrative database owners remain privileged; this is not a protection against a compromised DB owner.

## Validation and production boundary

Phase A was validated in the authorized PostgreSQL 17.6 laboratory: schema, ACL/RLS,
identity, rollback, CAS, idempotency and concurrency. Its SHA-256 remains:
3bc452b725e9811729d1c8743fa652bed395751596271929c7a8c982fbf21eeb.

The corrected OAuth Upgrade subsequently passed the real transactional suite, including
Admin permissions, one-use state, token rotation, rollback and concurrent version checks.
A post-upgrade Phase A smoke confirmed job creation, ownership, FK protection and queued transition.

Local tests cover injected adapters/clients, media probe, Admin/MFA, error sanitization,
request contracts, confirmation options, rate admission, SHA binding and upload ordering.
No real creator_info, init, upload or status request is needed for those tests.
Client rate limits are per instance; distributed coordination and operational refresh remain future work.
Clients and the FILE_UPLOAD coordinator are internal components, not a deployed publishing endpoint.
The minimal frontend added by this candidate is authorization-only, not a posting UI.

## Removed abandoned experiments — audit inventory

The following exact, previously documented untracked files were hash-verified and removed under explicit authorization during the final local checkpoint:
- supabase/functions/tiktok-media/local-proof.mjs: 4386 bytes; SHA256 ba6e30f1f3f7368d0cff049b05400f4a899fdc411b94ca1ef8629e26acc9728d
- supabase/functions/tiktok-media/local-proof.test.mjs: 4885 bytes; SHA256 2ce940476dd839fb8861174850837cb462ee72213c115085ccb00926ff9b9e55
- experiments/tiktok-worker-proof/proxy-proof.mjs: 3376 bytes; SHA256 ae1dd7decffafebaa733907f69fd1eb47fe238679a1d9af880f8e28861339734
- experiments/tiktok-worker-proof/proxy-proof.test.mjs: 5112 bytes; SHA256 4fb5d616c22f34b4845f929c0d9fb281c8bbbbbd9671595b1fad5abae8282e10c
Classification: experimental historical evidence, not production dependencies.
Prior proof outcomes (20 + 15 tests) are historical, not substitutes for FILE_UPLOAD tests. No proxy, custom-domain or Cloudflare implementation is included.
Deployment artifacts in experiments/production-releases remain outside scope and untouched.

## Local checkpoint inventory

A = approved Direct Post (8 files); B = approved OAuth Upgrade (14);
C = approved probe (2); D = necessary documentation (2).
E = four removed abandoned experiments listed above.
F = 574 release files (501,619,626 bytes) preserved under experiments/production-releases,
excluded from the commit. G = zero unexpected files.

### Grupo A
- supabase/functions/_shared/tiktok-posting/contract.mjs
- supabase/functions/_shared/tiktok-posting/file-upload.mjs
- supabase/functions/_shared/tiktok-posting/phase-a.test.mjs
- supabase/functions/_shared/tiktok-posting/posting-client.mjs
- supabase/functions/_shared/tiktok-posting/posting-client.test.mjs
- supabase/functions/_shared/tiktok-posting/posting-options.mjs
- supabase/functions/_shared/tiktok-posting/repository.mjs
- supabase/migrations/20260923010000_create_tiktok_publish_jobs.sql

### Grupo B
- frontend/src/lib/tiktok-oauth-connection.js
- frontend/src/pages/TikTokIntegration.jsx
- frontend/tests/tiktok-upgrade.test.mjs
- supabase/functions/_shared/tiktok/capabilities.ts
- supabase/functions/_shared/tiktok/client.ts
- supabase/functions/_shared/tiktok/tests/upgrade-admin-postgres.sql
- supabase/functions/_shared/tiktok/tests/upgrade-admin.test.ts
- supabase/functions/_shared/tiktok/tests/upgrade.test.ts
- supabase/functions/_shared/tiktok/upgrade.ts
- supabase/functions/tiktok-callback/handler.ts
- supabase/functions/tiktok-callback/index.ts
- supabase/functions/tiktok-connection/handler.ts
- supabase/functions/tiktok-connection/index.ts
- supabase/migrations/20260923020000_add_tiktok_direct_post_oauth.sql

### Grupo C
- supabase/functions/_shared/tiktok-posting/mp4-probe.test.mjs
- supabase/functions/_shared/tiktok-posting/mp4-probe.ts

### Grupo D
- docs/tiktok-direct-post-commercial-contract.md
- docs/tiktok-direct-post-oauth-upgrade.md

## Delivery boundary

One local checkpoint commit only, no push, remote SQL, secrets, deploy, Vercel, Meta,
OAuth, provider invocation, paid generation or ST. Production pre-flight is a separate
checkpoint. Runtime placement, operational refresh and final publishing UI remain outside
this commit; the existing Product Cleanup, economy and Meta integrations are preserved.

## Final local checkpoint gates

- Backend Login Kit/OAuth Upgrade/Phase A/probe/posting clients/Admin: 255/255.
- Frontend TikTok/Admin/Product Cleanup (including browser behavior): 84/84.
- Meta/social/legal regression: 88/89. The unchanged preexisting failure is
  "sessao ausente, cancelamento e identidade divergente nao iniciam backend" in
  smart-tour-social-publish.test.mjs, whose static assertion expects onClick={onClose}
  in BannerPublishDialog.jsx. This candidate does not modify either file.
- TikTok OFF and ON production builds pass in memory with public fictional env values.
- Credential-pattern scan across all 26 candidate files and both bundles: no findings.
- git diff --check passes. Only the explicit 26-file allowlist belongs in the commit.
- Release artifacts remain outside the candidate; the four recorded experiments are removed.
