# Smart Media Engine

## Visao

Smart Media Engine e a visao futura para unificar a criacao previsivel de midias do SmartCorretorAI.

## Principios

- Entregar previsibilidade.
- Evitar que o resultado pareca apenas PowerPoint animado.
- Permitir que o usuario escolha por preview/modelo visual, nao por tecnologia.
- Adaptar modelos visuais as imagens enviadas.
- Manter identidade visual consistente.
- Nao depender de Creatomate, Veo ou API externa para render basico local.

## Pipelines

- Photo Pipeline futuro: tratamento, selecao e preparacao de imagens.
- Motion Pipeline atual: animacao local de fotos fixas com FFmpeg.
- Video Pipeline futuro: suporte a videos reais enviados pelo usuario.
- Director futuro: regras de ritmo, narrativa, foco e ordem.
- Planner: transforma intencao/modelo visual em cenas.
- Renderer FFmpeg: gera MP4 final.

## Fases Concluidas

### Fase 1 - Smart Motion Engine

- Modulo local criado em `core/smart-motion-engine`.
- Entrada por JSON.
- Saida MP4 vertical `1080x1920`.
- H.264.
- 30 FPS.
- Legenda opcional.
- CTA opcional.
- Musica local opcional.
- Relatorio JSON.

### Fase 1.5 - Modelos Visuais

- Conceito evoluido para base do Smart Media Engine.
- Criado suporte a `visualModelId`.
- Criados modelos internos:
  - `clean_showcase`
  - `social_impact`
  - `luxury_soft`
  - `rental_direct`
- Criado `outputType` com `motion_video` funcional.
- Reports passaram a registrar modelo, outputType, movimentos, transicoes, CTA, musica e warnings.

## Ainda Nao Implementado

- Worker.
- Supabase.
- Storage.
- Edge Function.
- Frontend.
- Billing.
- Narracao.
- Musica licenciada final.
- Analise visual por IA.
- Smart Focus.
- Parallax real.
