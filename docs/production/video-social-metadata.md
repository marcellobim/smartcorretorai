# Video social publication metadata repair

Base: 048486b99ab72f4b9b450f077c7d99e7557e2086.

The official inline completion path omitted publication_options and output_media_metadata. Social publication correctly rejected the missing identity before job creation. Restore the canonical option builder at job creation and MIME from the existing delivered output at completion. Provider, prompt, rendering, credits and worker behavior are unchanged.

Legacy recovery is limited to completed smart_tour_gemini_omni jobs, owner-scoped canonical paths and an existing nonempty MP4 storage object. Missing options are derived with the existing official builder from the persisted versioned briefing. Existing valid options are preserved; malformed metadata is rejected.

The video adapter preserves the definitive 409 identity error. The shared dialog handles it only for video_imobiliario, displays a simple error and stops confirmation polling. Other products retain their handling.

Validation: 28 focused tests, 3 deployment guard tests and 13 mandatory smoke tests passed; build passed. Replay used the current video 13e01478-a799-422d-b2f8-efc1a13876a6. The actual database RPC created Instagram and Facebook jobs inside a transaction that was rolled back; no job remained and no request was sent to Meta.

Protected deployment: node scripts/production/deploy.mjs --video-social-metadata. This restricted option archives the exact checkpoint and deploys only smart-tour-generate and social-publish-video after frontend READY and baseline checks, then promotes the frontend. No migrations or worker changes.
