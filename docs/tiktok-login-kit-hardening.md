# TikTok Login Kit — hardening local, não publicado

Base: 155d6a880b38684a03010d0671ec67b2ee005ceb. Migration validada somente no laboratório isolado; não aplicada em produção ou staging.
Fase 1 solicita e aceita somente user.info.basic.

## Ambiente/app e configuração
TIKTOK_ACTIVE_ENVIRONMENT: sandbox ou production, obrigatório, sem fallback.
Conjuntos TIKTOK_SANDBOX_* e TIKTOK_PRODUCTION_*:
CLIENT_KEY, CLIENT_SECRET, REDIRECT_URI.
app_id = SHA-256 da client key pública selecionada no servidor. Trocar secret
preserva identidade; trocar client key cria outra partição.
Nenhum parâmetro HTTP escolhe o ambiente/app.

Registros dos dois ambientes coexistem no mesmo banco. Cada deployment tem
um ambiente ativo por vez. Trocar ambiente bloqueia callbacks pendentes da
outra partição: aguardar a janela de cinco minutos antes de uma troca planejada.
Connection e callback precisam da mesma configuração.
Frontend exige redirect URI igual a VITE_SUPABASE_URL + /functions/v1/tiktok-callback.

Comuns: TIKTOK_FRONTEND_ORIGIN, TIKTOK_FRONTEND_RETURN_URI.
Infraestrutura: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
Flag pública VITE_TIKTOK_LOGIN_KIT_ENABLED continua false por padrão.

## Criptografia
Keyring exclusivo TikTok compartilhado entre ambientes:
TIKTOK_TOKEN_ACTIVE_KEY_VERSION, TIKTOK_TOKEN_KEYRING_JSON.
AES-256-GCM com AAD vinculando versão do formato, ambiente, app_id, usuário,
open_id, tipo access/refresh e versão da chave. Reutilização entre contextos falha.
Keyring comum não é uma barreira independente contra comprometimento da chave.
Keyrings separados podem ser adotados se esse requisito surgir.
Não existem envelopes legados aplicados a migrar nesta migration local.

## Persistência
Três tabelas isoladas, ambiente/app, FK composta e open_id único por ambiente/app.
RLS e grants somente service_role; RPCs com search_path vazio.
State register/consume usam relógio do banco, TTL de cinco minutos e consumo único.
persist_tiktok_login salva conexão e conta em uma transação sem absorver exceções.
Trigger de banco controla created_at/updated_at e mantém identidade imutável.
Envelopes completos/canônicos ou todos NULL; conexão ativa exige ambos.
Conexão revogada deve limpar os envelopes e registrar revoked_at.

## Status público
disconnected, connected, access_token_expired, reconnect_required.
Somente connected possui connected=true e display_name sanitizado.
Nenhum refresh automático. Nenhum token/envelope/identificador privado é retornado.

## Refresh futuro — NÃO IMPLEMENTADO
token_version é geração CAS controlada pelo banco.
Antes de chamar refresh remoto, adquirir claim/lease por conexão, ambiente/app e
proprietário em futura RPC. CAS apenas depois do HTTP não evita duas rotações remotas.
Não manter transação PostgreSQL aberta durante HTTP.
Após sucesso, persistir ambos os envelopes, expirações e last_refreshed_at em
operação atômica sob versão/lease esperadas. Reconnect também incrementa a geração.
Timeout/resposta perdida pode ter rotacionado token: não repetir cegamente.
Definir estado incerto/reconnect_required e protocolo de reconciliação.
Persistência de claim/lease e RPC de commit de refresh ainda precisam de implementação
e teste real de concorrência antes de qualquer refresh operacional.

## Disconnect futuro — NÃO HABILITADO
Solicitação explícita autenticada; validar proprietário, ambiente/app e geração.
Coordenar com refresh/reconnect para evitar sobrescritas.
Helper revoke existe, mas não há endpoint/UI de desconexão habilitado.
Somente resultado remoto definido (sucesso/já revogado) permite futura RPC atômica
limpar envelopes/chave/expirações e atualizar conexão revoked e conta disconnected.
Em timeout/resultado incerto, não declarar revogação concluída.
Mapeamento operacional de resultados e coordenação permanecem pendentes.
Nenhuma chamada revoke real foi feita.

## Checkpoint PostgreSQL isolado concluído
Migration: 20260919220603_create_isolated_tiktok_login_kit.sql.
SHA-256: f8f7a60d35bc7b89081cdae7582d89220d4c411fd1c24f0a58a22659daa6ce08.
Gate: MIGRATION TIKTOK VALIDADA EM POSTGRESQL REAL (PostgreSQL 17.6).
Reaplicação única após limpeza cirúrgica no laboratório autorizado, sem CASCADE.
Inventário: 3 tabelas com RLS, 5 funções, 2 triggers, 12 índices, 42 constraints,
0 policies. Owner preservado; service_role com CRUD, sem TRUNCATE/REFERENCES/
TRIGGER/MAINTAIN; PUBLIC/anon/authenticated sem acesso direto.
Validados TTL de 300 segundos, replay, partições ambiente/app, ownership,
persistência/reconnect, timestamps, expirações e token_version.
Falha deliberada na conta deixou zero conexões/contas parciais.
Envelopes completos/NULL permitido aceitos; 28 casos inválidos rejeitados.
Roles efetivamente exercitadas. Duas sessões com bloqueio observado comprovaram
um único consumo do state e reconnect consistente, sem duplicação de conta.
A RPC de consumo retorna o usuário vinculado ao state; não recebe usuário
solicitante. Ela é exclusiva do backend confiável com service_role.
Fixtures fictícias e projeto temporário preservados para auditoria.
Testes locais com doubles/contratos SQL não substituem essa prova PostgreSQL.
Este registro não autoriza migration oficial, secrets, functions ou OAuth real.

## Validação do checkpoint local
Suíte TikTok: 112/112, incluindo contratos SQL/hardening.
Regressões relacionadas: 208/210; as duas falhas externas abaixo se repetem
na base exata 155d6a880b38684a03010d0671ec67b2ee005ceb, sem alteração dos
arquivos envolvidos: share-publish-actions (hash de asset oficial) e
smart-tour-social-publish (assertion estática do botão Cancelar).
Nenhuma dessas falhas foi corrigida neste escopo.
Product Cleanup comportamental: aprovado em 1440/900/390 px, incluindo
trial/Admin, guards e carrosséis. Smoke local aprovado, sem geração.
Builds de produção TikTok OFF e ON aprovados em memória com configuração
pública fictícia; scanner de credenciais dos fontes/bundles sem achados reais.
Nenhum serviço remoto acessado durante a preparação deste commit.

## Próximo checkpoint
Preparação controlada do Sandbox, mediante autorização específica.
Content Posting, Meta, economia e deploy de produção permanecem fora do escopo.
