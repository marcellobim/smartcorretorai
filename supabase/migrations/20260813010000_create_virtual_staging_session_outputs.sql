-- Staging tecnico backend-only para agregar os outputs de uma sessao de Virtual Staging.
-- Nao representa historico, galeria ou entrega direta ao frontend.

CREATE TABLE public.virtual_staging_session_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  job_id UUID NOT NULL,
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 5),
  output_path TEXT NOT NULL CHECK (
    output_path = user_id::text
      || '/virtual-staging-images/results/'
      || job_id::text
      || '/generated-01.jpg'
  ),
  mime_type TEXT NOT NULL CHECK (mime_type = 'image/jpeg'),
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  completed_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT virtual_staging_session_outputs_job_key
    UNIQUE (user_id, job_id),
  CONSTRAINT virtual_staging_session_outputs_path_key
    UNIQUE (user_id, output_path),
  CONSTRAINT virtual_staging_session_outputs_position_key
    UNIQUE (user_id, session_id, position)
);

CREATE INDEX idx_virtual_staging_session_outputs_session
  ON public.virtual_staging_session_outputs(user_id, session_id, position);

ALTER TABLE public.virtual_staging_session_outputs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.virtual_staging_session_outputs FROM PUBLIC;
REVOKE ALL ON public.virtual_staging_session_outputs FROM anon;
REVOKE ALL ON public.virtual_staging_session_outputs FROM authenticated;
GRANT SELECT, INSERT, DELETE ON public.virtual_staging_session_outputs TO service_role;
