-- =============================================
-- Corrige tabela campaigns + cria bucket de storage
-- =============================================

-- 1) Colunas que a Edge Function `gerar-campanha` precisa inserir
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS categoria   TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS fotos_urls  TEXT[] NOT NULL DEFAULT '{}';

-- 2) Bucket público para upload das fotos antes da invocação da função
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'smartcorretor-assets',
  'smartcorretor-assets',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 3) RLS no bucket: usuário autenticado pode subir e ler suas próprias fotos; qualquer um pode ler (bucket é público)
DROP POLICY IF EXISTS "smartcorretor_assets_authenticated_upload" ON storage.objects;
CREATE POLICY "smartcorretor_assets_authenticated_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'smartcorretor-assets');

DROP POLICY IF EXISTS "smartcorretor_assets_public_read" ON storage.objects;
CREATE POLICY "smartcorretor_assets_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'smartcorretor-assets');

DROP POLICY IF EXISTS "smartcorretor_assets_authenticated_delete" ON storage.objects;
CREATE POLICY "smartcorretor_assets_authenticated_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'smartcorretor-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 4) Reload do PostgREST schema (necessário para a API enxergar as colunas novas)
NOTIFY pgrst, 'reload schema';
