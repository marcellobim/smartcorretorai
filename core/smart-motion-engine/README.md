# Smart Motion Engine

Motor local inicial para transformar imagens fixas em MP4 vertical do SmartCorretorAI.

## Estado

Fase 1.5: modulo local reutilizavel, sem integracao com frontend, Supabase, Produto 3, Creatomate ou deploy.

## Visao Smart Media Engine

O Smart Motion Engine e a primeira parte local do futuro Smart Media Engine:

- Photo Pipeline futuro: tratamento e selecao de imagens.
- Motion Pipeline atual: movimento previsivel em fotos fixas.
- Video Pipeline futuro: suporte a video real enviado pelo usuario.
- Director futuro: regras de ritmo, ordem, foco e narrativa.
- Planner: transforma um modelo visual em cenas renderizaveis.
- Renderer FFmpeg: gera o MP4 final.

O motor proprio existe para entregar previsibilidade. Diferente de um gerador como Veo, ele nao tenta inventar um video novo nem depende de resultado aleatorio. O usuario deve escolher por exemplo/preview; internamente, o motor adapta aquele modelo visual as imagens enviadas, mantendo identidade consistente e repetibilidade.

O usuario final nao deve escolher `zoompan`, `xfade`, `pan` ou filtros tecnicos. Esses detalhes pertencem ao motor. A interface futura deve apresentar previews simples e deixar o modelo visual dirigir o resultado.

## O que faz

- Recebe entrada JSON.
- Gera MP4 vertical `1080x1920`.
- Usa H.264, 30 FPS e `yuv420p`.
- Aceita 1 ou mais imagens.
- Aplica presets de movimento:
  - `zoom_in`
  - `zoom_out`
  - `pan_left`
  - `pan_right`
  - `pan_up`
  - `pan_down`
  - `subtle_rotate`
  - `stable`
- Aplica transicoes:
  - `fade`
  - `crossfade`
  - `fadeblack`
  - `smoothleft`
  - `smoothup`
- Suporta legenda opcional.
- Suporta CTA final opcional.
- Suporta musica local opcional.
- Gera relatorio JSON do render.

## Modelos visuais internos

Os nomes abaixo sao internos. O usuario final deve ver previews, nao estes ids.

- `clean_showcase`: apresentacao limpa, elegante, com movimentos suaves, boa para imoveis prontos e fotos profissionais.
- `social_impact`: ritmo mais rapido, cortes mais marcantes, CTA forte, boa para Instagram/Reels/WhatsApp.
- `luxury_soft`: movimentos lentos, luz suave, CTA discreto, boa para alto padrao.
- `rental_direct`: direto ao ponto, leitura rapida, bom para locacao e imoveis usados.

## Como rodar o teste local

```bash
node core/smart-motion-engine/cli/render-motion-test.ts
```

Saidas esperadas:

```text
core/smart-motion-engine/output/clean-showcase.mp4
core/smart-motion-engine/output/social-impact.mp4
core/smart-motion-engine/output/luxury-soft.mp4
core/smart-motion-engine/output/rental-direct.mp4
core/smart-motion-engine/output/clean-showcase-report.json
core/smart-motion-engine/output/social-impact-report.json
core/smart-motion-engine/output/luxury-soft-report.json
core/smart-motion-engine/output/rental-direct-report.json
```

O CLI usa imagens de `experiments/slideshow-poc/input/alto-padrao-01` quando existirem. Se nao existirem, tenta usar `experiments/slideshow-poc/input/images`.

## JSON de entrada

```json
{
  "outputPath": "core/smart-motion-engine/output/test-motion.mp4",
  "reportPath": "core/smart-motion-engine/output/test-motion-report.json",
  "outputType": "motion_video",
  "visualModelId": "clean_showcase",
  "musicPath": "experiments/slideshow-poc/input/audio/music.mp3",
  "captionsEnabled": true,
  "ctaEnabled": true,
  "cta": "Agende sua visita",
  "scenes": [
    {
      "imagePath": "C:/caminho/para/imagem.jpg",
      "caption": "Living integrado",
      "motion": "zoom_in",
      "transition": "fade"
    }
  ]
}
```

## Sanitizacao

Texto livre nao entra diretamente no comando FFmpeg. O motor:

- limita tamanho de textos;
- remove caracteres de controle e pares Unicode invalidos;
- normaliza espacos;
- grava legendas/CTA em arquivos temporarios;
- usa `drawtext=textfile` com caminhos escapados.

## Dependencias

Nao foi adicionada dependencia nova nesta fase. O motor tenta usar:

1. `FFMPEG_PATH`, se definido;
2. `ffmpeg-static`, se resolvivel pelo Node;
3. `experiments/slideshow-poc/node_modules/ffmpeg-static/ffmpeg.exe`;
4. `ffmpeg` do sistema como fallback.

## Pendencias

- `enhanced_images`, `animated_images` e `full_video` estao apenas planejados no schema.
- Worker assincrono.
- Integracao com storage.
- Tabela de jobs.
- Preview de frames.
- Biblioteca de musicas licenciadas.
- Narração futura.
- QA visual amplo por tipo de foto.
