# Vídeo Imobiliário — retomada após falha de autenticação

## Problema e correção

No incidente de 18/09/2026 às 16h32 EDT, as cinco fotos foram recebidas, mas o Auth respondeu session_not_found e smart-tour-generate retornou 401 antes de criar o job ou reservar ST. O token ainda estava temporalmente válido. Não foi determinada a causa anterior da invalidação; esta correção não presume logout, expiração ou revogação específica.

A tela agora extrai o corpo do erro HTTP do SDK sem consumir a Response original, reconhece sessão inválida confirmada e orienta entrar novamente. Erros de rede/500 e uma negativa genérica de permissão 403 não são tratados como sessão revogada. O servidor valida a sessão via getUser antes de qualquer envio de arquivo. Uma invalidação posterior, inclusive na chamada da função ou na consulta do job, interrompe o fluxo e mostra o mesmo aviso.

O briefing, escolhas e conversa são salvos antes dessa validação e antes da chamada de geração, usando o mecanismo de rascunho existente. Login por senha e callback OAuth retornam para a revisão somente para a conta proprietária do rascunho; os gates existentes de onboarding, MFA, Admin e Turnstile continuam presentes. O botão Entrar novamente encerra somente a sessão local e apenas por ação explícita.

Nenhuma geração é disparada ao restaurar o rascunho. O usuário deve confirmar novamente. Quando já existe job pendente, a confirmação consulta esse job em vez de reenviar geração. O bloqueio de clique simultâneo e o mesmo clientRequestId complementam a idempotência existente do backend.

## Fotos e limites de recuperação

Guardam-se somente caminhos privados da própria conta, requestId e horário, nunca arquivos binários, tokens, credenciais ou URLs assinadas. A retomada aceita até cinco caminhos únicos, ordenados, com prefixo exato conta/smart-tour/request e nomes 01–05.jpg/png. Referências têm validade local de 24 horas. Após validar a sessão/identidade, uma leitura autenticada do Storage verifica a existência de cada objeto antes da reutilização. As políticas RLS existentes e a validação backend permanecem intactas.

Se as fotos expiraram, foram removidas ou não há referência válida, o briefing permanece e é preciso selecionar as fotos novamente. Uma seleção/ordenação diferente invalida a referência anterior. Uploads parciais não são tratados como conjunto completo. A recuperação depende de sessionStorage disponível e da mesma aba; o rascunho segue o TTL existente de sete dias. A correção não reconstrói retroativamente briefing ou referências perdidas antes de sua instalação e não remove os arquivos do incidente.

## Validação sem provider pago

- 24 testes de classificação de erro, sessão, propriedade/TTL/caminhos das fotos, existência no Storage, rascunho, recuperação de jobs, refresh, privacidade e gates: aprovados. Log em evidence/video-auth-20260918/tests.txt.
- 13 testes obrigatórios de Home, analytics e Banner gratuito: aprovados. Smoke dos nove produtos aprovado.
- Suites adicionais OAuth/Turnstile/hardening: 20 aprovados e uma falha preexistente de mensagem de cadastro sem identidade.
- Build de produção local aprovado; aviso preexistente de tamanho do chunk. Varredura dos 27 artefatos públicos aprovada, sem credenciais privadas ou configuração de staging. Mocks não entram no bundle de produção.
- Na tela real com todas as operações Supabase simuladas: sessão inválida no preflight = 1 consulta de Auth, 0 uploads, 0 chamadas de geração. 401 na função = aviso correto, botão de geração desabilitado, escolhas e cinco referências preservadas.
- Retorno simulado do login na mesma aba = briefing/corretora/fala/CTA preservados, confirmação disponível e zero chamadas automáticas. Só após clicar: 1 Auth, 1 listagem privada, 0 uploads, 1 geração simulada e 1 consulta simulada de status. Nenhum provider ou ST real.
- Evidências visuais: evidence/video-auth-20260918/401-relogin.png e restored-no-auto-send.png. Apenas dados sintéticos.
- Harness reproduzível: node frontend/tests/video-auth-server.mjs; abrir /tests/video-auth-behavior/?mode=invalid ou ?mode=invalid-at-invoke. O link Simular retorno após login preserva o rascunho e troca o mock para sessão válida. A tela exibe contadores; não configura credenciais nem chama serviços reais.

Cinco falhas antigas foram reproduzidas no checkout-base 3f9feb3: duas expectativas de rascunho de Banner/Virtual Staging, duas expectativas de rotas/textos antigos do Dashboard e a mensagem de cadastro sem identidade. A revisão posterior confirmou as cinco falhas novamente na base (18/23) e atualizou apenas as expectativas dos testes; as mesmas três suítes passaram 23/23. Ver revisão detalhada abaixo.

## Isolamento e publicação pendente

Branch codex/video-auth-recovery-20260918, sobre 3f9feb3, separada do PR #1 e de codex/admin-pr1-production-20260918. Nenhuma função, schema, conta, permissão, saldo ou deployment alterado. A sessão real do usuário e a tentativa do Admin não foram manipuladas.

Antes de publicar: revisar este PR; reconciliar os commits sobre o SHA que o alias oficial apontar após a publicação do Admin; salvar checkpoint privado; executar novamente as verificações obrigatórias do SHA final e somente node scripts/production/deploy.mjs. Não precisa de migration ou deploy de Edge Function para esta correção frontend. Após publicar, conferir o redirecionamento/revisão com login real e os gates existentes, sem acionar geração paga. Login/MFA/Turnstile reais não foram exercitados nesta validação isolada; os testes de comportamento usam mocks.

## Revisão do checkpoint 84052ce em 18/09

| Falha documentada | Evidência na base 3f9feb3 | Correção do teste | Impede publicação? |
| --- | --- | --- | --- |
| Banner: chave de rascunho | Runtime já separava visitante/conta | Assert contempla chave condicional | Não |
| Virtual Staging: conversa | Runtime já usava restoredConversation normalizada | Assert acompanha a normalização existente | Não |
| Smart Tour: rota | AccountAnalyticsRoute já envolvia a página | Assert preserva rota e wrapper | Não |
| Dashboard: catálogo | Nove produtos atuais, limite textCampaignAction | Verifica IDs, ordem e rota atuais | Não |
| Cadastro sem identidade | Mensagem neutra correta; regex falhava em CRLF | Normaliza CRLF apenas na leitura do teste | Não |

Reprodução: base 18/23 com as mesmas cinco falhas; testes atualizados 23/23. Execução conjunta de recuperação, hardening, draft, navegação e Turnstile: 34/34. Nenhum runtime foi alterado para satisfazer esses testes.

A publicação do Admin ainda não foi promovida: candidato 1d1cc5c READY; alias oficial continua em 3f9feb3. A integração será feita por ancestralidade em checkout separado, preservando ambos os PRs e o workspace principal.

Staging real: bucket studio-videos privado e políticas por auth.uid() confirmados por consulta ao banco; nenhuma política alterada. Harness tests/video-auth-staging opera exclusivamente com projeto e duas contas sintéticas permitidas. Usa Auth e Storage reais; não contém mocks nem chamada de geração. Login real/retomada ainda pendentes porque o Turnstile fica vazio no navegador interno. Foi disponibilizado acesso local com cópia de senha para participação no navegador externo. Este bloqueio de validação impede promover o candidato; simulações anteriores não completam o gate.
## Gate real concluído — 18/09/2026, 21:39–21:46 UTC

O usuário concluiu o primeiro login de staging na aba 4189. A seguir foram usados Auth/Storage reais, com a conta comum sintética e depois a conta Admin sintética; nenhum mock de autenticação, Storage ou navegação.

1. Cinco PNGs sintéticos enviados ao bucket privado; briefing sintético preparado na revisão. A própria conta listou cinco objetos, baixou uma foto e passou verifyVideoUploads.
2. A página de teste revogou somente a sessão sintética corrente via logout scope=local, mantendo o token antigo no SDK para reproduzir a sessão inválida. Ao confirmar nessa sessão inválida, o SDK retornou ao login real. A tela informou entrar novamente com a mesma conta, preservação do briefing e ausência de reenvio automático.
3. Login real com senha e Turnstile concluído: retorno automático à revisão, cinco fotos referenciadas, corretora, fala personalizada, tipo/localização/medidas e CTA preservados. Botão Confirmar e continuar aguardando ação; NÃO clicado com sessão válida.
4. Após o login, verifyVideoUploads e leitura das cinco fotos continuaram aprovados para a mesma conta.
5. Segunda conta real: listagem vazia e download autenticado sem cache negado. O primeiro download, com cache padrão e a mesma URL anteriormente lida pela proprietária, retornou a cópia do navegador. O harness agora usa download(..., {}, {cache:'no-store'}) para medir autorização do servidor. A listagem e o método de reutilização do aplicativo já bloqueavam a outra identidade. Nenhuma política foi ampliada. Arquivos já baixados por uma conta permanecem sujeitos ao cache local do navegador; isso não representa novo acesso autorizado pelo servidor.
6. Consulta ao banco para as duas contas desde 21:35 UTC: cinco fotos novas, zero video_jobs, zero economy_requests, zero credit_reservations e zero credit_transactions. Consulta dos logs function_edge_logs para smart-tour-generate no período: nenhum registro. As verificações não chamaram providers pagos.

Evidências reais: real-owner-photos.png, real-invalid-login.png, real-restored-confirmation.png, real-photos-after-login.png, real-other-account-cached.png (achado do cache) e real-other-account-no-cache.png (servidor negando acesso). O harness usa credenciais apenas pela sessão real existente, nunca as inclui no código ou evidências.

O gate real de retomada e isolamento está concluído. Não se declara geração de vídeo completa validada: a criação paga e o processamento do provider não foram executados. A publicação continua exigindo o fluxo oficial sobre o checkpoint integrado, e pós-conferência de produção.
