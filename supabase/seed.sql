-- Dados de exemplo para desenvolvimento
-- Execute SOMENTE em ambiente de desenvolvimento

-- Usuário demo (senha: demo12345)
INSERT INTO profiles (id, nome, email, senha_hash, creci, estado, plano) VALUES
(
  '00000000-0000-0000-0000-000000000001',
  'Marcos Oliveira',
  'demo@smartcorretorai.com.br',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBpj2tPqNUhCom', -- demo12345
  'CRECI-SP 12345-F',
  'SP',
  'pro'
);

-- Imóveis demo
INSERT INTO properties (user_id, titulo, tipo, finalidade, preco, area, quartos, banheiros, vagas, bairro, cidade, estado, descricao) VALUES
(
  '00000000-0000-0000-0000-000000000001',
  'Apartamento 3 quartos em Moema',
  'Apartamento',
  'Venda',
  1200000,
  110,
  3,
  2,
  2,
  'Moema',
  'São Paulo',
  'SP',
  'Lindo apartamento com acabamento de alto padrão, vista para área verde, condomínio completo com piscina, academia e salão de festas.'
),
(
  '00000000-0000-0000-0000-000000000001',
  'Casa em Condomínio - Alphaville',
  'Casa em Condomínio',
  'Venda',
  2800000,
  320,
  4,
  4,
  4,
  'Alphaville',
  'Barueri',
  'SP',
  'Casa espaçosa em condomínio fechado de alto padrão. Piscina privativa, jardim, churrasqueira e muito mais.'
),
(
  '00000000-0000-0000-0000-000000000001',
  'Loft Moderno - Vila Madalena',
  'Loft',
  'Locação',
  4500,
  65,
  1,
  1,
  1,
  'Vila Madalena',
  'São Paulo',
  'SP',
  'Loft moderno e estiloso no coração da Vila Madalena. Perfecto para jovens profissionais.'
);
