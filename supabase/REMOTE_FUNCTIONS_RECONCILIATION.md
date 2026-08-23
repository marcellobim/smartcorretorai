# Reconciliação Git ↔ Supabase remoto

Projeto: `sfbowejaevlmhcvsxhbk`
Baseline: `e20b35fdf5a4149332776cc267348a14c3423d89`
Inventário realizado em: 2026-08-23

Este documento é um artefato de controle. Nenhuma função foi implantada, removida ou alterada remotamente nesta rodada.

## Classificação

- **A — ativa e necessária:** deve existir no baseline, com auth/economia e testes.
- **B — legada referenciada:** precisa de migração controlada antes da retirada.
- **C — órfã candidata à retirada:** sem referência no Git e sem papel no produto ativo identificado.
- **D — inconclusiva:** não retirar enquanto fonte, caller externo ou integração não forem comprovados.

| Função remota | Git atual | Versão / implantação UTC | Referência local | Provider pago | Economia | Auth | Rate limit | Produto ativo | Classe / decisão |
|---|---|---|---|---|---|---|---|---|---|
| `criar-animacao-premium` | Não; fonte v20 recuperada apenas em diretório temporário | v20; criada 2026-07-06 00:52, atualizada 02:11 | Nenhuma em frontend, Edge Functions, migrations ou configuração | Creatomate direto | Nenhuma | JWT manual com `auth.getUser` | Não encontrado | Substituída pelos pipelines atuais | **C** — candidata à retirada remota controlada |
| `criar-video-ia-multi` | Não; fonte v21 recuperada apenas em diretório temporário | v21; criada 2026-07-07 00:30, atualizada 23:14 | Nenhuma | Veo quando flags remotas estão ativas | Nenhuma; persiste `tokens_reserved: 0` | JWT manual com `auth.getUser` | Não encontrado | Experimento multi-imagem não referenciado | **C** — candidata à retirada remota controlada |
| `create-smart-video-job` | Não; fonte v14 recuperada apenas em diretório temporário | v14; 2026-07-10 20:53 | Nenhuma | Não diretamente; cria job que pode alimentar worker | Nenhuma; retorna `not_configured`, reserva 0 | JWT manual com `auth.getUser` | Não encontrado | Substituída pelos geradores atuais | **C** — candidata à retirada após confirmar ausência de worker externo |
| `criar-checkout` | Não; bundle remoto indisponível pela API | v28; 2026-05-17 21:50 | Nenhuma; frontend atual usa `stripe-checkout` | Inconclusivo, provável Stripe | Inconclusiva | `verify_jwt=false`; auth interna não auditável | Inconclusivo | Possível cliente legado | **D** — não retirar sem fonte/logs e confirmação de clientes antigos |
| `creatomate-webhook` | Não; bundle remoto indisponível pela API | v28; 2026-05-17 21:37 | Nenhuma chamada interna | Callback de Creatomate provável | Inconclusiva | Webhook público esperado; assinatura não auditável | Inconclusivo | Pode estar registrado no provider | **D** — não retirar sem revisar URLs/callbacks no Creatomate |
| `get-render-job` | Não; bundle remoto indisponível pela API | v61; 2026-05-29 02:08 | Nenhuma | Inconclusivo | Inconclusiva | Gateway `verify_jwt=true`; lógica não auditável | Inconclusivo | Pode integrar fluxo legado de render | **D** — não retirar sem fonte, logs e jobs pendentes |
| `process-render-job` | Não; bundle remoto indisponível pela API | v28; criada 2026-05-29 02:08, atualizada 03:14 | Nenhuma | Inconclusivo | Inconclusiva | Gateway `verify_jwt=true`; lógica não auditável | Inconclusivo | Pode ser worker/cron legado | **D** — não retirar sem cron, logs e jobs pendentes |

## Evidências e limites

1. A busca foi feita em frontend, Edge Functions, migrations, testes e configuração versionados; nenhuma das sete slugs é chamada pelo baseline.
2. As três fontes recuperáveis não chamam outra Edge Function. Duas alcançam provider pago sem ledger econômico; a terceira cria jobs com zero reservado.
3. A API Supabase retornou `Failed to retrieve function bundle` para as quatro funções classificadas como D.
4. O repositório não contém cron, trigger ou webhook que referencie as sete slugs.
5. URLs registradas em Stripe/Creatomate, clientes antigos, métricas de invocação e schedules configurados fora do Git não puderam ser provados por esta inspeção.
6. Nenhum segredo hardcoded foi encontrado nas três fontes recuperadas.

## Plano de retirada controlada

1. Antes da próxima publicação, consultar logs de invocação por pelo menos uma janela operacional representativa.
2. Confirmar no Creatomate/Stripe que nenhum callback aponta para as funções candidatas.
3. Confirmar `cron.job`, triggers HTTP e filas/jobs pendentes no banco remoto.
4. Retirar primeiro `criar-animacao-premium` e `criar-video-ia-multi`; monitorar erros e custo.
5. Retirar `create-smart-video-job` somente após provar que nenhum worker consome seus jobs.
6. Para cada função D: recuperar a fonte por backup/suporte. Se necessária, trazê-la ao Git e auditá-la; se órfã comprovada, retirar.

## Resultado desta rodada

- Candidatas à retirada: `criar-animacao-premium`, `criar-video-ia-multi`, `create-smart-video-job`.
- Não autorizadas para retirada ainda: `criar-checkout`, `creatomate-webhook`, `get-render-job`, `process-render-job`.
- Funções que precisam entrar no Git agora: nenhuma comprovadamente necessária.
- Se qualquer função D permanecer ativa após a verificação externa, sua fonte correspondente passa a ser obrigatória no baseline antes do lançamento.
