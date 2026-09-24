# TikTok Direct Post — Vídeos Imobiliários, Parte 1

## Product audit

The active page is SmartTourAI.jsx at /smart-tour-ai. Its four visible presets are:

| Label | UI preset ID | Persisted/social product | Job mode |
| --- | --- | --- | --- |
| Fotos em Movimento | animate-images | video_imobiliario | smart_tour_gemini_omni |
| Legendas na Tela | campaign-video | video_imobiliario | smart_tour_gemini_omni |
| Narração Profissional | narrated-video | video_imobiliario | smart_tour_gemini_omni |
| Corretor Virtual IA | virtual-agent | video_imobiliario | smart_tour_gemini_omni |

All four use video_jobs.id/user_id/status/output_video_path. The final MP4 is produced by
smart-tour-generate/smart-tour-status and stored in studio-videos at
user_id/creation_id/smart-tour.mp4. The UI presets configure presenter/narration/captions;
they are not independent persisted product IDs. SmartTourAI normalizes generation.mode
to guided_tour, so narrated_tour is not the persisted ID for the Narração Profissional card.
Short Videos is hidden (SHORT_VIDEOS_VISIBLE=false) and its distinct job mode is not allowed.

All four share the existing Instagram/Facebook publication path:
buildSmartTourCampaignPackage -> CampaignPackage (videoPublish/sharePublish) ->
BannerPublishDialog -> smart-tour-social-publish -> social-publish-video.
These shared Meta components are inventory evidence only; this change does not modify them.

studio_ia_commercial is StudioHero's commercial Studio source type; social-publish-video
maps it to video_jobs.mode=dynamic_reel and user/creation/video.mp4. It is not the current
Vídeos Imobiliários product. The old Phase A documents and helper remain historical
contracts for those jobs; the new public endpoint allows only video_imobiliario.

## Database extension

20260924010000_allow_tiktok_video_imobiliario.sql adds the existing canonical ID
video_imobiliario to the explicit product CHECK and binds its exact path/mode in the
creation RPC. studio_ia_commercial remains allowed in the database solely for compatibility
with existing Phase A jobs. Original migrations are unchanged.

The replacement creation RPC keeps its signature, security definer/search_path, ACL,
admin/connection checks, snapshots, idempotency and all existing constraints.
No RLS policy, FK, grant, CAS, claim or transition contract changes.

## API

Only tiktok-content-posting is added, with verify_jwt=true. All actions authenticate the
JWT via getUser and require the existing Admin and AAL2 gates plus server-configured Sandbox/app.
Unknown request keys are rejected, including nested options/consent keys.
The public product_type is video_imobiliario; creation_id is video_jobs.id.

- prepare: action, product_type, creation_id. Resolves owner/completed creation, the exact
  server-owned storage path, MIME and size; downloads bounded bytes and probes the MP4;
  validates connection/scopes/lifetime and fresh creator_info/duration. Returns only creator
  projection, media metadata, a 300-second preview, null privacy selection and is_aigc=true.
  It never creates a job or initializes a post.
- confirm: action, product_type, creation_id, idempotency_key, options, consent.
  options contains title, privacy_level, disable_comment, disable_duet, disable_stitch,
  brand_content_toggle, brand_organic_toggle. Privacy must be chosen explicitly.
  consent contains confirmed, commercial_disclosure, music_usage_confirmed,
  branded_content_policy_confirmed. AIGC is always set by the server.
  Fresh creator_info and an MP4 snapshot precede durable job creation, CAS claim and init.
  The fingerprint includes confirmed consent choices. The existing persisted consent version
  is retained to preserve Phase A constraints.
- status: action, job_id. Loads only owner/environment/app-scoped jobs; terminal jobs do not
  call TikTok. Active claims are respected. Expired initializing/uploading leases become
  reconciliation_required; no missing-ID job can be reinitialized by polling.

The coordinator reuses posting-client, posting-options, file-upload PUT and mp4-probe.
FILE_UPLOAD init is never retried blindly. publish_id is durably ACKed before consuming
the non-enumerable, single-use upload URL capability and issuing PUT.
Tokens and upload URLs stay in memory; no refresh or OAuth is initiated.
Expired/short-lived access tokens, invalid refresh expiry or insufficient scopes require
reauthorization. Unknown scopes also fail closed.

Status labels: Publicando, Processando, Publicado, Falhou, Verificação necessária.
The existing 120-second claim can defer provider polling until lease expiry, even though
next_poll_at is 10 seconds. No database lease bypass was added.
Provider raw errors, tokens, claim values and publish/upload capabilities are never returned.
A persistence failure after job creation returns its job_id and verification-required state;
status resolves the durable outcome after lease expiry.

## Validation and deployment

Directed tests use only mocks/local bytes, never OAuth, provider init/upload/status or ST.
The focused PostgreSQL runner provisions an empty disposable local instance and verifies
only the additive product change: old-job preservation, new-product success, owner/mode/path
rejection, allowlist, idempotency, ACL/RLS and queued transition.

The existing Login Kit hash test now compares canonical LF content so Windows CRLF checkout
does not fail the immutable migration check. No migration bytes were rewritten by this change.

Production preflight found callback v2, connection v2 and content-posting v1 already ACTIVE.
Their existing public posting implementation was restricted to the Studio product.
Authorized redeployment therefore increments provider versions; it cannot retain v1/v2 numbers.
Deploy order is callback, connection, additive migration, content-posting.
Only project sfbowejaevlmhcvsxhbk is authorized. No other function or frontend deployment.

## Part 2 boundary

Frontend integration remains pending: connect all four presets' common campaign publication
point to prepare/confirm/status, display creator restrictions and temporary media preview,
require explicit privacy/consents and recover jobs by their sanitized status.
No TikTok posting UI or Meta component changes are part of this commit.
The existing Studio-only posting UI, if enabled elsewhere, uses a different contract and must
not be wired to this endpoint without the Part 2 integration.

Real Edge CPU/memory/upload behavior at the 50 MiB limit has not been exercised against
TikTok, in accordance with the prohibition on real posts. The limit is enforced before
allocation/download; provider mocks and structural MP4 tests are not a live publication proof.
