# TikTok OAuth Direct Post — contrato do candidato

## Escopo e capacidades

LOGIN_BASIC continua exatamente user.info.basic. DIRECT_POST deriva de user.info.basic +
video.publish. Nenhuma coluna capability é fonte de verdade; video.upload e scopes
desconhecidos são rejeitados. Não há publicação de produto nesta página.

Contratos auditados: oauth.ts (URL/state), client.ts (token parser), repository.ts/RPC
básica, tiktok-connection/handler.ts (status), tiktok-callback/handler.ts (persistência),
frontend/src/lib/tiktok-oauth-connection.js (URL/response) e TikTokIntegration.jsx (UI).
Migration, RPC e parser padrão do Login Kit básico permanecem compatíveis.

## Upgrade e segurança

POST action=direct_post_upgrade aceita somente esse campo. O backend exige Sandbox,
autenticação real e os helpers existentes requireAuthorizedAdmin + requireAdminAal2.
Usuário, conexão, scopes, redirect e app não são decididos pelo frontend.

State possui prefixo dp. e 32 bytes aleatórios. O prefixo seleciona o parser; a RPC
confere hash, flow tiktok_direct_post_upgrade, ambiente, app e redirect. O banco vincula
usuário, conexão existente e token_version, com TTL de 300 segundos e consumo único.
Os fluxos básico/upgrade não consomem o state um do outro.

Callback valida o endereço configurado. Concessão parcial retorna upgrade_scope_missing,
sem persistência; cancelamento consome o state e preserva a conexão existente.
Concessão completa cifra access/refresh separadamente antes de uma única RPC transacional.
Essa RPC bloqueia a conexão, confere identidade e versão, atualiza scopes/envelopes/expirações
e conta; o trigger original incrementa token_version. Não há retry automático.

## Autorização no banco

tiktok_upgrade_admin_allowed(uuid) é o único helper SECURITY DEFINER novo: owner postgres,
STABLE, search_path vazio, auth.role() = service_role, somente leitura de membership
em admin_users e retorno booleano. EXECUTE apenas para owner/service_role.
Nenhum grant de tabela foi acrescentado.

register_tiktok_direct_post_state e persist_tiktok_direct_post_upgrade usam o helper.
consume_tiktok_direct_post_state não consulta admin_users. As três RPCs operacionais são
invocadoras, com EXECUTE somente para service_role/owner e search_path vazio.

O padrão administrativo existente usa admin_users e MFA no handler. Sua migration
20260816030000 prevê acesso direto para service_role; o laboratório mínimo não tinha
esse grant. Conceder SELECT ampliaria acesso desnecessariamente. is_authorized_admin()
usa auth.uid(), não o usuário vinculado ao state numa chamada de serviço. Usar somente
o handler removeria a defesa no banco. O helper dedicado evita essas alternativas.

anon/authenticated não recebem acesso ao helper/RPCs, mesmo com claim adulterada.
service_role permanece um principal backend confiável. A RPC não verifica MFA por si:
AAL2 continua validado pelo handler. O gate HTTP preexistente também depende da fundação
Admin do ambiente; o helper não altera essa fundação.

## Status e interface

GET original mantém o contrato. GET ?view=capabilities acrescenta somente booleans e
connected_basic/direct_post_authorized. Expirações continuam access_token_expired e
reconnect_required, sem refresh automático.

Com flag ON, somente Admin vê a autorização de publicação e, quando Basic, o botão
Autorizar publicação no TikTok. A rota Admin/MFA existente permanece intacta.
Falha na leitura de capabilities não libera a ação nem invalida Login Basic.
Callback de erro recarrega o status e mostra mensagem allowlisted.
Não há botão para publicar produto.

## Migration e validação PostgreSQL concluída

Nova migration: 20260923020000_add_tiktok_direct_post_oauth.sql.
SHA-256: 0ead0e3e4ffe2dc5978dfc2554d09d36eae7282091a7eef65f3d147022666129.

Original Login Kit intacta:
f8f7a60d35bc7b89081cdae7582d89220d4c411fd1c24f0a58a22659daa6ce08.

No checkpoint anterior, o laboratório autorizado (PostgreSQL 17.6) recebeu a versão
corrigida uma vez após remoção cirúrgica da anterior e prova de estado limpo.
Passaram: helper sem SELECT direto em admin_users, ACL/RLS, Basic, TTL/consumo único,
replay, fluxo cruzado, parcial/cancelamento, scopes inválidos, identidade, CAS e rollback
real após falha em tiktok_accounts. Duas sessões distintas com lock observado provaram
uma única atualização N para N+1, sem mistura de envelopes. Smoke Fase A aprovado.

O script upgrade-admin-postgres.sql usa exclusivamente fixtures sintéticas e transação
revertida. Nunca executá-lo em produção. O laboratório foi preservado como evidência.
Nenhuma operação remota faz parte do checkpoint de commit local.

## Limites e próximos checkpoints

Não houve OAuth real com video.publish nem publicação real. Refresh operacional de
conexões Direct Post, integração dos clientes/coordenador e execução do worker ainda
precisam de checkpoints próprios. Concessão parcial preserva o banco local, mas a
validade dos tokens antigos perante o provedor não pode ser garantida offline.

Um novo fluxo Basic continua estrito; não se pressupõe que o provedor retorne apenas
Basic após concessões adicionais. Produção requer pré-flight e autorização separados:
migrations aditivas, duas functions e frontend devem ser coordenados. Não aplicar
migrations, publicar functions ou iniciar OAuth automaticamente a partir deste commit.
