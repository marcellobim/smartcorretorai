# Fase 1 — fundação da arquitetura comercial

Este documento registra o checkpoint de recuperação criado em 2026-08-16. A
fundação está instalada no Supabase remoto, mas permanece desativada e não ativa
cobrança, Stripe, trial, promoção ou integração de produtos.

## Estado de ativação

- O catálogo canônico está em `supabase/functions/_shared/economic-catalog.ts`.
- `ECONOMIC_CATALOG_ACTIVATED` permanece `false`.
- Todos os SKUs permanecem com `enabled: false`.
- As RPCs de produção `reserve_credits`, `consume_reserved_credits` e
  `cancel_credit_reservation` não foram substituídas.
- As novas RPCs paralelas terminam em `_from_lots` e são acessíveis somente ao
  `service_role`.
- As migrations `20260816010000` e `20260816020000` estão aplicadas no projeto
  remoto e registradas no migration history.
- A fundação foi instalada com zero lotes, zero allocations e zero eventos
  econômicos. Nenhum entitlement foi concedido pela instalação.

## Baseline remoto deste checkpoint

Este checkpoint corresponde ao estado remoto confirmado por leitura em
2026-08-16:

- P0 financeira `20260815010000` aplicada;
- P0 Admin `20260816030000` aplicada;
- 6 profiles, todos no plano `free`;
- saldo agregado e `creditos_avulsos` iguais a zero;
- nenhuma expiração de créditos, trial, subscription ou reserva aberta;
- `admin_users` com uma conta oficial vinculada a `auth.users`;
- `credit_lots` instalado e com zero linhas;
- `credit_reservation_allocations` e `economic_generation_events` com zero linhas;
- view privada de reconciliação sem divergências;
- catálogo econômico globalmente desativado;
- nenhum produto conectado às RPCs `_from_lots`;
- Stripe novo e trial novo ainda não implementados.

Migration history relevante aplicado:

- `20260815010000`;
- `20260816010000`;
- `20260816020000`;
- `20260816030000`.

Permanecem pendentes e fora deste checkpoint:

- `20260715010000`;
- `20260808010000`;
- `20260808020000`.

O Git não reverte automaticamente o estado do Supabase. Recuperar este commit
restaura os artefatos locais, mas qualquer recuperação do banco exige um plano
remoto explícito e separado.

## Compatibilidade e ativação futura

`profiles.saldo_creditos` permanece o cache visual. Depois da ativação de lotes,
`sync_credit_balance_cache_from_lots` o atualiza com a soma dos lotes visíveis,
ativos e não expirados. Lotes `hidden_from_ui`, incluindo trial futuro, não entram
nesse cache. `profiles.creditos_expiram_em` fica nulo após sincronização: uma única
data legada não consegue representar vários lotes, e usar a primeira expiração
apagaria incorretamente todo o saldo agregado no leitor antigo.

A migration `20260816020000` não faz backfill. Ela exige um baseline comercial
limpo e falha de forma fechada se encontrar saldo, créditos avulsos, expiração,
trial, identificadores Stripe, subscription, reserva aberta ou lote preexistente.
Ela não limpa nem corrige dados automaticamente e não fabrica lotes ou allocations.

`credit_transactions` e reservas fechadas permanecem como histórico técnico de
desenvolvimento. Não representam entitlement atual, não são convertidas em lotes e
não precisam reconciliar com o novo saldo comercial. A view privada compara apenas
o cache atual, os lotes atuais e as reservas abertas.

## Mapa de integração da próxima fase

| Produto | product_code / variant | Reservar antes de | Consumir em | Cancelar em |
|---|---|---|---|---|
| Vídeo Imobiliário | `real_estate_video / standard` | `smart-tour-generate`, imediatamente antes do Gemini | conclusão persistida no `smart-tour-generate`/`smart-tour-status` | qualquer falha terminal após a reserva |
| Short Videos | `short_videos / standard` | `smart-tour-generate`, antes do Gemini | somente após vídeo final legendado persistido em `smart-tour-status` | falha Gemini, Creatomate, download, validação ou storage |
| Vida no Imóvel | `life_in_property / standard` | `virtual-staging-generate`, antes do Gemini | após composição final persistida em `virtual-staging-status` | falha Gemini/Creatomate/storage |
| Apresentação pelo Corretor | `broker_presentation / standard` | `virtual-staging-generate`, antes do Gemini | após composição final persistida em `virtual-staging-status` | falha Gemini/Creatomate/storage |
| Banner Imobiliário | `real_estate_banner / pieces_1,3,5,6` | `gerar-hero-ia`, uma reserva do pacote antes do primeiro Responses job | após todas as peças contratadas terem entrega terminal bem-sucedida | falha total; política de sucesso parcial deve ser definida antes da integração |
| Virtual Staging | `virtual_staging / images_1,3,5` | `virtual-staging-image-test`, uma reserva de pacote antes da primeira edição | após todas as imagens contratadas serem persistidas | falha total; definir cobrança proporcional para sucesso parcial |
| Campanha de Textos | `text_campaign / standard` | `generate-text-campaign`, antes da primeira chamada OpenAI | após pacote completo e hashtags validados | falha em qualquer chamada/validação |
| Smart Carrossel | `smart_carousel / photos_5,10,20` | `smart-carousel-creatomate`, antes da inteligência GPT | após render final do Creatomate estar disponível | falha GPT, criação ou conclusão do render |
| Comercial Imobiliário | `real_estate_commercial / standard` | `criar-video-ia`, antes do Veo | `get-video-job-status`, após entrega final | `criar-video-ia`/`get-video-job-status` em falha terminal |
| Vídeo Criativo | `creative_video / standard` | `criar-video-ia`, antes do Veo | `get-video-job-status`, após entrega final | `criar-video-ia`/`get-video-job-status` em falha terminal |
| Banners Rápidos | `quick_banners / static_pieces_1,3,5` | `gerar-banners`, antes do fill OpenAI/Creatomate | `get-render-status`, por peça concluída | `gerar-banners`/`get-render-status`, por peça falha |

Google Ads não possui SKU nem reserva própria: continua incluído no pacote do produto.

## FEFO e reservas

`reserve_credits_from_lots` serializa operações por usuário com lock no profile,
expira lotes, verifica o total e aloca na ordem:

1. `expires_at ASC NULLS LAST`;
2. `created_at ASC`;
3. `id ASC`.

O débito ocorre na reserva. O consumo somente confirma allocations. O cancelamento
restaura cada lote original se ainda válido; lote vencido não ressuscita.

## Trial e promoção — apenas preparação

O schema aceita lote `source='trial'` e `hidden_from_ui=true`. A concessão, o teto
interno e `trial_grants` não foram implementados. O catálogo marca elegibilidade,
mas está globalmente desativado.

A promoção START também não foi implementada. O modelo mínimo futuro deve ter um
registro server-side de elegibilidade e uso, independente do estado Stripe. Uma
recarga não deve alterar essa elegibilidade. Evitar campos de ciclo antecipados até
o contrato do webhook e da assinatura estar definido.

## Stripe — apenas preparação

`credit_lots` oferece referências idempotentes para invoice e checkout. Índices
únicos impedem criar dois lotes para a mesma invoice ou compra. Não há checkout,
webhook ou chamada Stripe nesta fase.

## Telemetria econômica

`economic_generation_events` é uma proposta privada para registrar produto, SKU,
provider, modelo, duração, quantidade, usage, custo estimado/protegido em micros,
versão do catálogo e estado da entrega. A tabela não aceita nem precisa armazenar
tokens, API keys, payloads de autenticação ou outros segredos.

Banner Imobiliário, Virtual Staging e templates variáveis devem permanecer com
precificação provisória até existir amostra suficiente dessa telemetria.

## Sequência segura de ativação futura

1. Preservar a fundação instalada e desativada deste checkpoint.
2. Testar concorrência real em PostgreSQL antes da ativação comercial.
3. Definir provisioning idempotente de planos, compras, trial e promoção.
4. Integrar apenas um produto por vez às RPCs `_from_lots`.
5. Validar reserva, entrega, consumo, cancelamento e telemetria desse produto.
6. Ativar somente os SKUs explicitamente homologados.
7. Observar reconciliação e custos antes de integrar o produto seguinte.
8. Somente depois substituir ou envolver as RPCs financeiras legadas.
