# Slideshow POC

POC local para validar a geração de um MP4 vertical imobiliário com fotos em tela cheia, legendas discretas, CTA final, movimento elegante e música opcional, sem Creatomate, sem Supabase e sem API externa de vídeo.

## Estrutura

```text
experiments/slideshow-poc/
  input/
    images/
    audio/
      music.mp3
    slides.json
  output/
    output.mp4
  render-slideshow.js
```

## Como colocar imagens

Coloque as imagens em:

```text
experiments/slideshow-poc/input/images/
```

Depois referencie cada arquivo em `input/slides.json`.

A POC agora exige entre 6 e 10 fotos reais. Ela não cria placeholders automaticamente.

Exemplo:

```json
{
  "headline": "Apartamento de alto padrão",
  "slides": [
    {
      "image": "foto1.jpg",
      "caption": "Ambientes amplos e integrados"
    }
  ],
  "cta": "Agende sua visita"
}
```

Se alguma imagem não existir ou parecer pequena demais para um teste real, o script para e mostra o erro.

## Música opcional

Para incluir música, adicione:

```text
experiments/slideshow-poc/input/audio/music.mp3
```

Se o arquivo não existir, o vídeo é exportado sem áudio.

## Como rodar

Instale as dependências locais desta POC:

```bash
cd experiments/slideshow-poc
npm install
```

Gere o vídeo:

```bash
npm run render
```

Saída:

```text
experiments/slideshow-poc/output/output.mp4
```

## O que esta versão faz

- Gera vídeo vertical `1080x1920`.
- Usa apenas fotos em tela cheia.
- Exige de 6 a 10 fotos reais.
- Aplica efeito Ken Burns em cada imagem.
- Alterna automaticamente zoom in, zoom out e movimentos de pan.
- Adiciona transições suaves de fade/cross dissolve entre cenas.
- Renderiza legendas discretas com faixa translúcida em área segura para celular.
- Adiciona CTA final sobre a última foto.
- Adiciona música automaticamente se `input/audio/music.mp3` existir.
- Não cria tela de abertura, tela azul ou cartão técnico.
- Não cria imagens de amostra ou placeholders.

## Dependências

- Node.js
- FFmpeg via `ffmpeg-static`

Também é possível usar um FFmpeg instalado no sistema definindo:

```bash
FFMPEG_PATH=/caminho/para/ffmpeg npm run render
```

## Limitações

- Não tem narração.
- Não tem avatar.
- Não tem IA de vídeo.
- Não faz edição automática de ritmo por batida musical.
- Não usa frontend, Supabase, créditos, storage ou Produto 2.

## Caminho futuro

Esta POC pode evoluir para um worker externo:

1. Edge Function cria um job seguro.
2. Worker baixa imagens de storage privado.
3. Worker monta slides com FFmpeg.
4. Worker adiciona música licenciada.
5. Worker salva MP4 final em storage privado.
6. Frontend consulta status por polling.
