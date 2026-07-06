# Studio Hero Multi-imagens com Veo - POC

POC local e controlada para testar Studio Hero com multiplas imagens usando Veo em sequencia e montagem final por FFmpeg.

## Escopo

- Nao integra frontend.
- Nao altera Supabase.
- Nao altera Produto 3.
- Nao altera IA Livre sem imagens.
- Nao remove Creatomate.
- Nao faz deploy.

## Ideia

Para uma lista de imagens, a POC cria pares consecutivos:

Com CTA:

```text
1 -> 2
2 -> 3
3 -> 4
4 -> CTA
```

Sem CTA/textos:

```text
1 -> 2
2 -> 3
3 -> 4
4 -> imagem-vazia
```

Cada par vira um job Veo independente. Depois, os clipes baixados sao concatenados localmente com FFmpeg.

## Prompt

A POC usa uma copia local do prompt base atual do Produto 2 com imagens, sem depender da Edge Function:

```text
You are an award-winning director of real estate commercials.
...
Use the uploaded image as the visual reference.
...
Surprise the viewer.
```

O objetivo e testar comportamento real do Veo com pares, inclusive se ele repete narracao/textos.

## Como rodar sem chamar Veo

```powershell
node experiments\studio-hero-multi-veo-poc\render-multi-veo-poc.mjs --dry-run
```

Isso cria/atualiza:

```text
experiments/studio-hero-multi-veo-poc/output/report.json
experiments/studio-hero-multi-veo-poc/output/cta-frame.png
experiments/studio-hero-multi-veo-poc/output/empty-frame.png
```

## Como rodar chamando Veo

Requisitos:

- `VEO_ENABLED=true`
- `GEMINI_API_KEY`
- `VEO_MODEL_ID` opcional
- `FFMPEG_PATH` opcional

```powershell
$env:VEO_ENABLED="true"
$env:GEMINI_API_KEY="..."
$env:FFMPEG_PATH=(Resolve-Path 'experiments\slideshow-poc\node_modules\ffmpeg-static\ffmpeg.exe').Path
node experiments\studio-hero-multi-veo-poc\render-multi-veo-poc.mjs --run
```

Saida esperada quando os jobs completarem:

```text
experiments/studio-hero-multi-veo-poc/output/final-multi-veo.mp4
experiments/studio-hero-multi-veo-poc/output/clips/*.mp4
experiments/studio-hero-multi-veo-poc/output/report.json
```

## Configuracao

O arquivo [sample-config.json](./sample-config.json) usa imagens locais da POC de slideshow.

Para outro teste:

```powershell
node experiments\studio-hero-multi-veo-poc\render-multi-veo-poc.mjs --dry-run --config caminho\config.json
```

Exemplo sem CTA:

```powershell
node experiments\studio-hero-multi-veo-poc\render-multi-veo-poc.mjs --dry-run --config experiments\studio-hero-multi-veo-poc\sample-config-no-cta.json
```

## Limitacoes

- Nao resolve narracao.
- Nao cria prompt complexo por clipe.
- Nao faz upload/storage.
- Nao consome creditos do SmartCorretorAI.
- Nao integra status/polling do Produto 2.
- A montagem final so acontece se os clipes forem baixados com sucesso.
