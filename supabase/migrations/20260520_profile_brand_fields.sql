-- =============================================
-- Perfil do Corretor: campos de marca/contato
-- Os usados pelo gerar-banners para popular o Creatomate
-- =============================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS whatsapp     TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS imobiliaria  TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS site         TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS instagram    TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS logo_url     TEXT;

-- nome (full name), creci, telefone, email e avatar_url já existem no schema base.

-- Reload do PostgREST schema (necessário para a API enxergar as colunas novas)
NOTIFY pgrst, 'reload schema';
