-- Server-owned recovery identity for Smart Tour jobs.
-- Recovery/acknowledgement never starts a provider or changes the economy.

ALTER TABLE public.video_jobs
  ADD COLUMN IF NOT EXISTS recovery_acknowledged_at TIMESTAMPTZ NULL;
ALTER TABLE public.video_jobs
  ADD COLUMN IF NOT EXISTS generation_guard_version SMALLINT NOT NULL DEFAULT 0;
-- Do not resurrect historical terminal jobs after rollout. Keep only the most
-- recent terminal attempt from the last 24 hours recoverable for each owner.
WITH ranked_terminal AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC, id DESC) AS owner_rank
    FROM public.video_jobs
   WHERE mode IN ('smart_tour_gemini_omni', 'smart_tour_gemini_omni_short_video')
     AND status IN ('completed', 'failed')
     AND recovery_acknowledged_at IS NULL
), historical_terminal AS (
  SELECT j.id
    FROM public.video_jobs j
    JOIN ranked_terminal r ON r.id = j.id
   WHERE r.owner_rank > 1 OR j.created_at < NOW() - INTERVAL '24 hours'
)
UPDATE public.video_jobs j
   SET recovery_acknowledged_at = COALESCE(j.recovery_acknowledged_at, NOW())
  FROM historical_terminal h
 WHERE j.id = h.id;
CREATE INDEX IF NOT EXISTS idx_video_jobs_smart_tour_owner_recovery
  ON public.video_jobs(user_id, created_at DESC)
  WHERE mode IN ('smart_tour_gemini_omni', 'smart_tour_gemini_omni_short_video')
    AND recovery_acknowledged_at IS NULL;
-- The database is the final race-proof barrier against parallel/ambiguous
-- attempts. Both generators insert the job before reserving Smart Tokens.
CREATE UNIQUE INDEX IF NOT EXISTS idx_video_jobs_one_active_smart_tour_per_owner
  ON public.video_jobs(user_id)
  WHERE mode IN ('smart_tour_gemini_omni', 'smart_tour_gemini_omni_short_video')
    AND status IN ('pending', 'generating')
    AND generation_guard_version = 1;
