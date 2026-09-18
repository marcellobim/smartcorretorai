# Candidato integrado Admin + retomada de Vídeo — 18/09/2026

## Estado e isolamento

Base oficial verificada: 3f9feb3efcf7c828a9c95a55cb1e3e7c2c367701, deployment dpl_8cfNg58PfbJWiP9GJivYrPq7rt8o. Admin candidato 1d1cc5c está READY mas não foi promovido. Este checkout descende de 1d1cc5c e incorpora o PR #2 84052ce como 04dba3e, seguido da revisão de testes 73ff458 como 44667ae. Os arquivos do Admin são idênticos ao candidato já validado. Nenhum arquivo ou commit paralelo foi substituído.

## Verificações deste candidato

- Ancestralidade de 3f9feb3: PASS.
- Smoke dos nove produtos: PASS.
- 25 testes: 13 obrigatórios, sete de release/guard e cinco de recuperação de sessão: PASS.
- Build local: PASS, 1594 módulos; aviso anterior de chunk >500 KB permanece.
- Varredura de 27 artefatos públicos: PASS; sem credenciais privadas, contas sintéticas, referência do staging ou chave Turnstile de teste.
- Testes visuais do Admin reaproveitados por identidade dos arquivos; não são declarados nova validação de produção.
- Cinco falhas preexistentes reproduzidas na base (18/23), testes atualizados (23/23); suíte conjunta ampliada 34/34. Ver docs/video-auth-recovery-20260918.md.

## Gate ainda pendente

Login real e retomada em staging não concluídos: o widget Turnstile permanece vazio no navegador interno. Acesso local para conta sintética fornecido para login em navegador externo. Não promover enquanto não forem verificados mensagem clara, briefing preservado, confirmação obrigatória e acesso às fotos apenas pela mesma conta. Nenhuma geração paga autorizada ou executada. Este checkpoint não é uma publicação.

## Publicação após aprovação do gate

Consultar novamente alias e admin-api; se Production mudou, integrar sobre o novo SHA e repetir checks. Usar exclusivamente node scripts/production/deploy.mjs --admin-api, com ADMIN_API_EXPECTED_VERSION igual à versão real preservada (25 na conferência anterior). A correção de vídeo não exige Edge Function ou migration. VERCEL_CLI, SUPABASE_CLI e POWERSHELL_CLI devem apontar para CLIs oficiais já instaladas. As travas de archive/prova/alias/segredos permanecem ligadas. O fluxo repete os checks obrigatórios sobre o SHA exato.

## Recuperação seletiva preparada, não aplicada

A branch privada codex/admin-pr1-before-20260918 preserva 3f9feb3, inclusive o código verificado da admin-api v25. A recuperação nunca promove deployment antigo nem faz rollback geral.

- Só correção de vídeo: video-auth-20260918-recovery.patch é inverso dos cinco arquivos frontend do PR #2; preserva Admin e guards.
- Só Admin: admin-pr1-20260918-recovery.patch, já preservado e documentado.
- Ambas: aplicar os dois patches seletivos sobre um checkout do SHA oficial vigente, após git apply --check e revisão de eventuais mudanças paralelas.

Antes de qualquer recuperação: consultar Production, criar branch descendente do SHA atual, revisar mudanças concorrentes, confirmar a versão atual de admin-api se afetada, aplicar apenas o escopo necessário, verificar segredos/testes/build, salvar checkpoint privado e usar o fluxo oficial. Os patches foram conferidos com git apply --check no candidato integrado, sem modificar arquivos. Não alteram banco, saldos, contas, MFA, Turnstile ou dados de produção.
