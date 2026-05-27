# SmartCorretorAI - Status Atual do Sistema

Auditoria feita em 2026-05-27. Este documento registra o estado atual observado, sem alteracao de codigo.

## Estado do Repositorio no Inicio da Auditoria

Antes da criacao destes documentos, o repositorio ja estava com alteracoes locais:

- `supabase/functions/gerar-banners/index.ts` modificado.
- `AGENTS.md` nao rastreado.

Esses arquivos nao foram revertidos nem alterados por esta auditoria.

## Geracao de Textos

Estado atual:

- `gerar-campanha` gera 6 campos:
  - `titulo_campanha`
  - `descricao_portal`
  - `post_instagram`
  - `script_video_reels`
  - `carrossel_passo_a_passo`
  - `mensagem_whatsapp`
- A Edge Function salva os textos em `campaigns.textos_gerados`.
- O frontend exibe esses campos na tela de resultado.
- A geracao de textos nao depende mais de selecionar formato visual.

Risco atual:

- A funcao `gerar-campanha` esta com `verify_jwt = false` e aceita fallback por `user_id` no body quando nao ha usuario autenticado no token. Isso provavelmente foi intencional em algum momento, mas e uma superficie de seguranca que deve ser revisada com cuidado antes de endurecer autenticacao.

## Upload de Fotos

Estado atual:

- O upload ocorre em `NovaCampanha.jsx`.
- O bucket usado e `smartcorretor-assets`.
- O path segue o padrao:
  - `{userId}/campaigns/{timestamp}_{index}.jpg`
- O frontend usa o cliente Supabase autenticado e o token do contexto de auth.

Risco atual:

- Se `session?.access_token` no contexto estiver ausente, o fluxo deve bloquear o upload e pedir novo login.
- Como upload e geracao dependem de sessao valida, qualquer regressao em `auth-context.jsx` pode impactar diretamente a geracao de banners.

## Geracao de Banners e Videos

Estado atual:

- `NovaCampanha.jsx` chama `gerar-banners` em paralelo com `gerar-campanha`, mas somente quando existe ao menos um template selecionado.
- Se nenhum template visual for selecionado, o fluxo pula `gerar-banners` e continua gerando textos.
- `gerar-banners` salva os renders em `campaigns.banners` quando recebe `campaign_id`.
- No fluxo paralelo atual, o frontend primeiro chama `gerar-banners` sem `campaign_id` e depois vincula os renders a campanha recem-criada via update em `campaigns.banners`.

Riscos atuais:

- O fluxo de banners esta duplicado: existe chamada paralela no botao principal e ainda existe o botao separado "Gerar banners e videos" na tela de resultado.
- A Edge Function exige templates validos contra a lista interna `TEMPLATES`. IDs novos que nao estejam nessa lista sao descartados.
- Se o usuario selecionar apenas templates novos nao cadastrados no backend, a funcao tende a retornar erro de "Nenhum template valido".

## Integracao Creatomate

Estado atual:

- Backend usa `Deno.env.get('CREATOMATE_API_KEY')`.
- Backend consulta elementos reais do template antes de pedir para a IA montar `modifications`.
- Backend dispara renders via `POST /v1/renders`.
- Frontend faz polling direto na API do Creatomate.

Risco critico:

- O frontend ainda contem uma constante hardcoded com a chave Creatomate para polling dos renders. Isso expõe segredo no browser e deve ser removido em uma etapa segura futura, de preferencia criando uma Edge Function/proxy de polling.

## Perfil do Corretor

Estado atual:

- `Configuracoes.jsx` permite editar dados de perfil do corretor.
- `gerar-banners` busca dados do perfil para preencher corretor, contato, avatar/logo e imobiliaria.
- Campos do banco relevantes:
  - `nome`
  - `email`
  - `creci`
  - `telefone`
  - `whatsapp`
  - `imobiliaria`
  - `site`
  - `instagram`
  - `avatar_url`
  - `logo_url`

Risco atual:

- O campo `site` ainda existe no backend e migrations, mesmo tendo sido removido da interface em trabalho anterior. Isso nao quebra por si so, mas e um campo legado que pode gerar comportamento inesperado se voltar a ser usado em prompts/templates.

## Autenticacao

Estado atual:

- `frontend/src/lib/supabase.js` usa:
  - `persistSession: true`
  - `autoRefreshToken: true`
  - `detectSessionInUrl: true`
- `auth-context.jsx` centraliza `authUser`, `session`, `profile` e `accessToken`.
- `NovaCampanha.jsx` usa o token do contexto em vez de chamar `getSession` manualmente no fluxo de upload.

Riscos atuais:

- O AuthContext possui fallback com `getSession()` se o evento `INITIAL_SESSION` nao chegar. Isso e isolado no contexto, mas qualquer alteracao nessa area pode reabrir o bug de usuario preso no login apos F5.
- Nao mexer em login/logout/autenticacao durante a troca de templates.

