# Studio Hero V3.1 - Teste Controlado Alto Padrao 01

## Escopo

Teste local e isolado da POC `experiments/slideshow-poc`, usando imagens reais copiadas de:

`assets-imoveis/alto-padrao-01`

Nenhum produto real foi alterado. Nenhum frontend, Supabase, backend ou Studio Hero real foi integrado.

## Auditoria Rapida Do Motor Atual

A V3 atual le:

- `experiments/slideshow-poc/input/slides.json`
- imagens em `experiments/slideshow-poc/input/images/`
- exporta `experiments/slideshow-poc/output/output-v3.mp4`

Problema observado na V3:

- A classificacao dependia principalmente de nome/caption.
- Como as captions eram genericas, quase todas as imagens caiam em `detail`.
- Isso reduzia a diferenca visual entre cenas e repetia movimentos.

## Estrutura Criada Para O Teste

Entrada isolada:

- `experiments/slideshow-poc/input/alto-padrao-01/slides.json`
- `experiments/slideshow-poc/input/alto-padrao-01/images/`

Script isolado:

- `experiments/slideshow-poc/render-studio-hero-v31-alto-padrao.js`

Saidas:

- `experiments/slideshow-poc/output/output-v31-alto-padrao-01.mp4`
- `experiments/slideshow-poc/output/output-v31-alto-padrao-01-summary.json`
- `experiments/slideshow-poc/output/REPORT_V31_ALTO_PADRAO_01.md`

## Video Gerado

- Arquivo: `output/output-v31-alto-padrao-01.mp4`
- Resolucao: 1080x1920
- Codec: H.264
- FPS: 30
- Duracao: 25,47s
- Audio: nao
- Motivo: nao existe `input/audio/music.mp3` na POC.

## Narrativa

Narrativa escolhida:

1. abertura com impacto visual
2. lazer/amenidade
3. living/cozinha
4. suite/dormitorio
5. varanda/vista
6. banheiro/detalhe premium
7. CTA final

## Imagens Usadas

| Ordem | Arquivo | Classificacao | Legenda | Movimento |
|---:|---|---|---|---|
| 1 | `Screenshot_20260622_062941_Chrome.jpg` | pool | LAZER COM VISTA | aspirational-wide-pan |
| 2 | `Screenshot_20260622_062959_Chrome.jpg` | gourmet | VARANDA GOURMET | diagonal-gourmet-travel |
| 3 | `Screenshot_20260622_063020_Chrome.jpg` | living | LIVING INTEGRADO | soft-lateral-living |
| 4 | `Screenshot_20260622_063115_Chrome.jpg` | kitchen | COZINHA PLANEJADA | elegant-kitchen-pan |
| 5 | `Screenshot_20260622_063130_Chrome.jpg` | suite | SUITE MASTER | premium-suite-push |
| 6 | `Screenshot_20260622_063126_Chrome.jpg` | bedroom | CONFORTO PRIVATIVO | quiet-bedroom-drift |
| 7 | `Screenshot_20260622_063303_Chrome.jpg` | balcony | VISTA URBANA | depth-balcony-move |
| 8 | `Screenshot_20260622_063108_Chrome.jpg` | bathroom | ACABAMENTO PREMIUM | short-detail-bathroom |
| 9 | `Screenshot_20260622_063108_Chrome.jpg` | CTA | AGENDE SUA VISITA | stable-cta-frame |

## Melhorias Em Relacao A V3

- A classificacao nao depende mais apenas da deteccao automatica por texto generico.
- Cada slide recebeu um `type` explicito.
- Nenhuma imagem caiu em `detail` por acidente.
- Movimentos foram suavizados para reduzir tremor.
- O zoom foi reduzido e passou a ter intencao por ambiente.
- CTA final ficou estavel, evitando movimento excessivo no fechamento.
- A narrativa ficou mais imobiliaria: lazer, gourmet, living, cozinha, suite, dormitorio, vista, banheiro e CTA.

## Pendencias Para V3.1 Real

- Criar classificacao visual automatica real para nao depender de `type` manual.
- Adicionar trilha musical padrao com fade in/fade out.
- Melhorar selecao automatica de imagens quando houver muitas fotos.
- Criar suporte a perfis: alto padrao, vazio, locacao, lancamento e comercial.
- Avaliar cortes de imagem por orientacao para evitar perder partes importantes em fotos horizontais.
- Gerar thumbnails/frame preview para comparacao rapida.
- Reduzir o tempo de render ou preparar worker assíncrono se virar produto.

## Avaliacao

Este teste e mais coerente que a V3 original para o grupo `alto-padrao-01`.

Ele ainda nao substitui video IA real, mas ja mostra um caminho viavel para um modo `Carrossel Inteligente` dentro do Studio Hero, principalmente quando o objetivo for entregar um video rapido, barato e visualmente melhor do que slideshow basico.

