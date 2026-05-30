# PLANO_TECNICO_V2_CREDITOS_CATALOGO.md

## Status Inicial

- Base de partida: `master`
- Branch criada: `feature/v2-creditos-catalogo`
- Working tree antes da criacao do plano: limpa
- `gerar-banners` remoto recuperado e realinhado com a master
- Edge Function `gerar-banners`: v22
- Teste remoto anterior: HTTP 200, `success: true`, `renderCount: 1`

## Regras De Execucao

- Nao usar Cline.
- Nao aplicar `stash`.
- Nao fazer merge da branch `template-canonical-schema`.
- Nao copiar arquivos grandes da branch antiga.
- Nao substituir `NovaCampanha.jsx` inteiro.
- Nao implementar sem aprovacao explicita.
- Manter `selectedTemplates` como contrato final com o backend.
- Cliente nunca ve Creatomate, OpenAI, GPT, UUID ou `template_id`.

## Objetivo Da V2

Construir a V2 com creditos reais, catalogo premium visual e campanhas inteligentes sem quebrar a geracao atual.

O usuario deve ver:

- creditos
- saldo apos gerar
- artes premium
- videos premium
- campanhas inteligentes
- pacotes Economica, Premium IA e Completa

O sistema deve continuar enviando ao backend:

- `selectedTemplates`
- `fotos_urls`
- `foto_principal`
- dados reais do imovel
- dados reais do corretor quando existirem

## Modelo De Creditos

### Planos

| Plano | Creditos Mensais | Preco Trimestral | Preco Mensal |
|---|---:|---:|---:|
| START | 1.000 | R$ 97/mes | R$ 127/mes |
| PRO | 2.500 | R$ 187/mes | R$ 247/mes |
| ELITE | 6.000 | R$ 497/mes | R$ 597/mes |

### Recargas

| Recarga | Preco | Validade |
|---:|---:|---:|
| 500 creditos | R$ 59 | 30 dias |
| 1.000 creditos | R$ 99 | 30 dias |
| 2.000 creditos | R$ 179 | 30 dias |

### Regras

- Multiplicador x10 mantido.
- Margem alvo: 48% a 65%.
- Textos IA nao consomem creditos.
- Banners consomem menos creditos.
- Videos consomem mais creditos.
- Creditos de assinatura nao acumulam.
- Creditos expiram em 30 dias.
- Recargas expiram em 30 dias apos compra.
- Downloads liberados apenas para usuario com creditos/assinatura ativa.
- Teste gratis permite visualizar, mas nao baixar.

## Pacotes De Geracao

| Pacote | Custo | Finalidade |
|---|---:|---|
| Economica | 40 creditos | Pacote leve com artes essenciais e video basico |
| Premium IA | 200 creditos | Artes premium com textos IA inclusos |
| Completa | 500 creditos | Artes premium + videos + formatos principais |

Regras:

- Pacotes apenas pre-selecionam itens do catalogo.
- Usuario pode editar manualmente.
- Saldo nao define campanha sugerida.
- Saldo apenas habilita ou desabilita pacotes.
- Saida final continua sendo `selectedTemplates`.

## Catalogo Premium Estilo Netflix

O catalogo deve substituir a percepcao tecnica de template por cards comerciais.

Cada item do catalogo deve ter:

- nome comercial
- descricao curta
- formato
- tipo: arte ou video
- custo em creditos
- preview visual quando disponivel
- estado selecionado/desmarcado
- acao selecionar/desmarcar

Controles esperados:

- selecionar item
- desmarcar item
- selecionar todos
- limpar selecao
- filtros por tipo/formato/campanha

Nao exibir ao cliente:

- Creatomate
- OpenAI
- GPT
- UUID
- `template_id`
- nomes tecnicos internos

## Campanhas Inteligentes

Campanhas oficiais:

- Venda Rapida
- Luxo Premium
- Lancamento
- Minha Casa Minha Vida
- Airbnb / Temporada
- Comercial
- Captacao de Imovel

Modos oficiais:

- Economica
- Premium IA
- Completa

Regra principal:

Campanha e definida pelo imovel. Modo e definido pela escolha/saldo do usuario.

Exemplo:

- Campanha recomendada: Luxo Premium
- Disponivel: Economica e Premium IA
- Indisponivel: Completa por saldo insuficiente

## Fluxo Oficial Da Nova Campanha

Ordem aprovada:

1. Dados do imovel
2. Fotos do imovel
3. Pacotes sugeridos
4. Catalogo visual premium
5. Resumo de creditos
6. Gerar campanha

Importante:

- Nao reescrever `NovaCampanha.jsx` inteiro.
- Refatorar por componentes pequenos.
- Preservar a geracao atual ate cada etapa estar validada.
- Reset do formulario deve limpar dados, fotos, formatos, resultados, renders e polling.

## Fotos Especificas

Campos desejados:

- `foto_principal`
- `foto_fachada`
- `foto_interna`
- `foto_lazer`
- `foto_planta`
- `foto_bairro`
- `foto_corretor`

Regras:

- Nunca inventar imagem.
- Se uma foto especifica nao existir, ocultar ou deixar vazio.
- `foto_principal` deve continuar entrando primeiro em `fotos_urls`.
- Fotos secundarias devem preservar ordem previsivel.

## Regra Contra Dados Falsos

Se campo nao existir:

- ocultar
- deixar vazio
- remover elemento quando possivel

Nunca inventar:

- nome
- telefone
- WhatsApp
- CRECI
- logo
- foto de corretor
- imagem de imovel
- endereco
- preco

## Arquivos Provavelmente Alterados

### Frontend

- `frontend/src/pages/NovaCampanha.jsx`
  - Integracao incremental dos novos componentes.
  - Nao substituir arquivo inteiro.

- `frontend/src/pages/Planos.jsx`
  - Planos START/PRO/ELITE.
  - Recargas.
  - Regras de creditos.

- `frontend/src/pages/Dashboard.jsx`
  - Saldo real.
  - Expiracao.
  - CTA de recarga.

- `frontend/src/pages/Configuracoes.jsx`
  - Ajustes de copy se houver mencoes antigas a anuncios/limites.

- `frontend/src/pages/PacotesGerados.jsx`
  - Bloqueio de downloads no teste gratis.
  - Mensagem de upgrade/recarga.

### Novos Arquivos Frontend Sugeridos

- `frontend/src/data/creditCosts.js`
- `frontend/src/data/campaignModes.js`
- `frontend/src/data/campaignTemplates.js`
- `frontend/src/data/templateCatalog.js`
- `frontend/src/utils/propertyContext.js`
- `frontend/src/utils/campaignRecommendationEngine.js`
- `frontend/src/components/marketing/SmartCampaignSuggestions.jsx`
- `frontend/src/components/marketing/PremiumTemplateCatalog.jsx`
- `frontend/src/components/marketing/CreditSummary.jsx`
- `frontend/src/components/marketing/SpecificPhotoUpload.jsx`

### Backend / Supabase

- `supabase/migrations/<timestamp>_credit_infrastructure.sql`
- `supabase/migrations/<timestamp>_credit_reservations.sql`
- `supabase/functions/gerar-banners/index.ts`
  - Somente apos frontend e banco estabilizados.
  - Adicionar validacao server-side de saldo.
  - Manter contrato `selectedTemplates`.

Possivel etapa posterior:

- `supabase/functions/get-render-job/index.ts`
- `supabase/functions/process-render-job/index.ts`
- `supabase/migrations/<timestamp>_render_jobs.sql`

Render queue deve ser fase separada, nao misturada com catalogo/creditos.

## Tabelas E Migrations Necessarias

### `profiles`

Adicionar:

- `saldo_creditos bigint default 0`
- `creditos_expiram_em timestamptz`

### `credit_transactions`

Campos:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid references auth.users(id)`
- `tipo text`
- `creditos bigint not null`
- `saldo_resultante bigint not null`
- `observacao text`
- `metadata jsonb default '{}'`
- `created_at timestamptz default now()`

Tipos:

- `assinatura`
- `recarga`
- `consumo`
- `ajuste_admin`
- `expiracao`

### `credit_reservations`

Campos:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid references auth.users(id) not null`
- `campaign_id uuid null`
- `idempotency_key text not null`
- `amount bigint not null`
- `status text not null`
- `reason text`
- `metadata jsonb default '{}'`
- `created_at timestamptz default now()`
- `consumed_at timestamptz null`
- `cancelled_at timestamptz null`

Indice unico:

- `user_id + idempotency_key`

### RPCs

- `add_credits(user_id, amount, tipo, observacao, metadata, expires_at)`
- `consume_credits(user_id, amount, observacao, metadata)`
- `get_credit_balance(user_id)`
- `expire_user_credits(user_id)`
- `reserve_credits(user_id, amount, idempotency_key, campaign_id, reason, metadata)`
- `consume_reserved_credits(user_id, idempotency_key, observacao, metadata)`
- `cancel_credit_reservation(user_id, idempotency_key, reason)`

## Ordem De Implementacao

### Fase 0 - Backup E Higiene

1. Confirmar branch nova.
2. Confirmar working tree limpa.
3. Rodar build baseline.
4. Documentar estado inicial.

### Fase 1 - Dados Puros

1. Criar custos.
2. Criar modos.
3. Criar campanhas.
4. Criar catalogo canonico.
5. Nao integrar UI ainda.

### Fase 2 - Creditos Backend

1. Criar migration de saldo e transacoes.
2. Criar RPCs.
3. Testar via SQL.
4. Criar reservas/idempotencia.
5. Testar consumo duplicado.

### Fase 3 - Creditos Frontend

1. Exibir saldo real.
2. Exibir expiracao.
3. Exibir custo estimado.
4. Mostrar saldo apos gerar.
5. Bloqueio visual por saldo.
6. Sem debito real ainda.

### Fase 4 - Catalogo Premium

1. Criar componente isolado.
2. Mapear cards comerciais para IDs internos.
3. Selecionar/desmarcar.
4. Garantir que UI nao exibe IDs.
5. Saida: `selectedTemplates`.

### Fase 5 - Pacotes Sugeridos

1. Criar Economica/Premium IA/Completa.
2. Cada pacote pre-seleciona catalogo.
3. Usuario pode editar.
4. Saldo habilita/desabilita pacote.

### Fase 6 - Fotos Especificas

1. Criar upload por slot.
2. Converter para `fotos_urls`.
3. Garantir `foto_principal`.
4. Nunca inventar imagem.

### Fase 7 - Campanhas Inteligentes

1. Montar `propertyContext`.
2. Criar motor de recomendacao.
3. Recomendar campanha principal + ate duas alternativas.
4. Campanha + modo pre-seleciona catalogo.
5. Saida final continua `selectedTemplates`.

### Fase 8 - Debito Real

1. Frontend envia `credit_cost`, `generation_mode`, `idempotency_key`.
2. `gerar-banners` valida saldo server-side.
3. Reservar antes de custo externo.
4. Consumir apos iniciar geracao visual com sucesso.
5. Cancelar reserva se falhar antes do custo externo.

### Fase 9 - Download / Teste Gratis

1. Usuario gratis visualiza.
2. Usuario gratis nao baixa.
3. CTA: comprar creditos ou assinar plano.
4. Compra avulsa deve ser permitida sem assinatura ativa.

### Fase 10 - Render Queue

1. Implementar somente depois da V2 basica estar estavel.
2. Migration `render_jobs`.
3. `get-render-job`.
4. `process-render-job`.
5. Testes de fila e falha parcial.

## Riscos

- Reintroduzir encoding quebrado.
- Quebrar `NovaCampanha.jsx` por edicao grande.
- Desalinhar frontend e `gerar-banners`.
- Consumir credito sem render efetivo.
- Permitir download no teste gratis por caminho alternativo.
- Expor IDs internos na UI.
- Duplicar debito por clique duplo.
- Misturar render queue com creditos cedo demais.
- Usar templates inexistentes ou desativados no Creatomate.

## Mitigacoes

- Uma fase por vez.
- Build apos cada fase.
- Nao copiar arquivos grandes da branch antiga.
- Componentizar antes de integrar.
- Logs temporarios seguros apenas onde necessario.
- Testar sempre com usuario real.
- Validar payload final antes de deploy.
- Deploy controlado de uma Edge Function por vez.

## Testes Necessarios

### Frontend

- `npm run build`
- Nova campanha com campos minimos.
- Reset de formulario.
- Upload de fotos.
- Selecao/desmarcacao no catalogo.
- Pacote sugerido pre-seleciona itens.
- Usuario edita selecao manualmente.
- UI nao mostra UUID/template_id.

### Creditos

- saldo suficiente
- saldo insuficiente
- creditos expirados
- recarga
- consumo
- clique duplo com mesma `idempotency_key`
- tentativa de bypass pelo frontend

### Backend

- `selectedTemplates` valido
- `selectedTemplates` vazio
- template invalido
- JWT ausente
- JWT expirado
- sem foto
- sem nome/telefone/CRECI/logo
- Creatomate falha
- OpenAI falha

### Produto

- START 1.000 creditos
- PRO 2.500 creditos
- ELITE 6.000 creditos
- recargas corretas
- texto IA gratuito
- video mais caro que banner
- teste gratis visualiza sem baixar

## Criterio De Pronto

A V2 so deve ser considerada pronta quando:

- master visualmente estavel nao regredir
- `gerar-banners` continuar retornando 2xx com payload valido
- `selectedTemplates` continuar sendo a saida final
- creditos forem debitados com idempotencia
- usuario nao vir IDs tecnicos
- teste gratis nao conseguir baixar
- build passar
- fluxo completo for testado com usuario real

## Recomendacao Final

Implementar a V2 em fases pequenas sobre a branch `feature/v2-creditos-catalogo`.

Comecar por dados puros e creditos backend. So depois integrar catalogo e campanhas inteligentes na `NovaCampanha`.

Nao trazer `NovaCampanha.jsx` antigo da branch experimental. Nao trazer `gerar-banners` inteiro da branch experimental. Reaproveitar apenas ideias e contratos ja auditados.
