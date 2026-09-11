# Video and Banner incident — 2026-09-11

Baseline: 87563f4b33572cae1410aca8aa11dd7eacc9872a. No paid generation performed.

## Video

User confirmed one image, custom presenter speech and no final CTA. Recent uploads at 19:37:24 and 19:41:42 UTC exist, but no matching video job, economy request or credit reservation. The function logs/invocations have no corresponding generation call. Balance checked: 2015 ST, zero reserved.

Local replay of the actual package builder throws `invalid_google_ads_cta`: the absent video CTA becomes the 33-character Portuguese contact sentence, which exceeds Google Ads' 30-character bound. This builder runs after upload and before the function invocation.

One-line fix: pass the selected CTA to the existing Google Ads builder; absence now uses its existing bounded default. Social copy, custom speech, generation request and provider remain unchanged. Oversized explicit CTA is still rejected.

Three focused tests pass, including executing the actual createTour handler with mocked upload/invoke: exactly one image and unchanged custom speech reach the expected function with empty selectedCta. A paid end-to-end run was unnecessary and was not performed.

## Banner timing (UTC)

Existing completed generation 4dc5be30-304e-4875-89e2-854363546961:

| Evidence | Time / duration |
| --- | --- |
| Click telemetry | 19:20:35.294 |
| Economy request created | 19:20:36.096 |
| Economy started | 19:20:37.647 |
| Generation created | 19:20:38.643 |
| Provider submission HTTP 200 | 19:20:40; request duration 1758 ms |
| Provider still in_progress | 19:25:45 |
| Provider completed detected | 19:25:50 |
| Storage object created | 19:25:51.340 |
| Generation completed | 19:25:51.479 |
| Economy completed | 19:25:52.128 |

Click to persisted result: 316.185 s. Job creation to completion: 312.836 s. Provider processing/queue dominates (about 305–310 s after submission); provider-internal queue and processing cannot be separated from these logs. Polls approximately every five seconds; observed HTTP poll latency 108–442 ms near completion. Storage/finalization follows detection within about 1.5 s. Exact browser receipt/render time is not persisted. No local artificial multi-minute wait or delayed dispatch found. No Banner optimization applied; no supported prediction of reduced runtime. Quality and delivery unchanged.

## Validation

Focused regression tests: 3/3. Mandatory Home/guest/Admin tests: 13/13. Production smoke and build passed. Private-secret scan covers changed sources and build artifacts.

Additional existing source-text assertions in google-ads-product-packages and smart-tour-social-publish fail for unchanged Banner/social-dialog text. The same failures reproduce in the archived GOLDEN baseline; they were not modified or bypassed in the mandatory deploy smoke.
