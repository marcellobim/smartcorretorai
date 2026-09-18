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

Cinco falhas antigas foram reproduzidas no checkout-base 3f9feb3: duas expectativas de rascunho de Banner/Virtual Staging, duas expectativas de rotas/textos antigos do Dashboard e a mensagem de cadastro sem identidade. Não foram alteradas nem apresentadas como aprovadas nesta correção.

## Isolamento e publicação pendente

Branch codex/video-auth-recovery-20260918, sobre 3f9feb3, separada do PR #1 e de codex/admin-pr1-production-20260918. Nenhuma função, schema, conta, permissão, saldo ou deployment alterado. A sessão real do usuário e a tentativa do Admin não foram manipuladas.

Antes de publicar: revisar este PR; reconciliar os commits sobre o SHA que o alias oficial apontar após a publicação do Admin; salvar checkpoint privado; executar novamente as verificações obrigatórias do SHA final e somente node scripts/production/deploy.mjs. Não precisa de migration ou deploy de Edge Function para esta correção frontend. Após publicar, conferir o redirecionamento/revisão com login real e os gates existentes, sem acionar geração paga. Login/MFA/Turnstile reais não foram exercitados nesta validação isolada; os testes de comportamento usam mocks.
