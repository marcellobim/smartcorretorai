# Studio Hero V3.1 - alto-padrao-01

## Escopo

Experimento local da POC, sem integracao ao produto real.

## Video Gerado

- Arquivo: `output/v31-alto-padrao-01.mp4`
- Resolucao: 1080x1920
- Codec: H.264
- FPS: 30
- Duracao estimada: 25.44s
- Musica: nao

## Narrativa

Perfil: alto-padrao

1. Abertura com impacto visual
2. Piscina/amenidade/lazer
3. Living/cozinha
4. Suite/dormitorio
5. Varanda/vista
6. Banheiro/detalhe
7. CTA final

## Imagens, Classificacao E Movimentos

| Ordem | Arquivo | Tipo | Legenda | Movimento | Nome tecnico | Transicao |
|---:|---|---|---|---|---|---|
| 1 | `Screenshot_20260622_062941_Chrome.jpg` | pool | LAZER COM VISTA | POOL_LUXURY | aspirational-wide-pan | fadeblack |
| 2 | `Screenshot_20260622_062959_Chrome.jpg` | gourmet | VARANDA GOURMET | AMENITY_REVEAL | diagonal-gourmet-travel | smoothup |
| 3 | `Screenshot_20260622_063020_Chrome.jpg` | living | LIVING INTEGRADO | LIVING_PREMIUM | soft-lateral-living | fade |
| 4 | `Screenshot_20260622_063115_Chrome.jpg` | kitchen | COZINHA PLANEJADA | KITCHEN_REVEAL | elegant-kitchen-pan | smoothleft |
| 5 | `Screenshot_20260622_063130_Chrome.jpg` | suite | SUITE MASTER | SUITE_SLOW | premium-suite-push | fadeblack |
| 6 | `Screenshot_20260622_063126_Chrome.jpg` | bedroom | CONFORTO PRIVATIVO | BEDROOM_SOFT | quiet-bedroom-drift | fade |
| 7 | `Screenshot_20260622_063303_Chrome.jpg` | balcony | VISTA URBANA | BALCONY_VIEW | depth-balcony-move | smoothup |
| 8 | `Screenshot_20260622_063108_Chrome.jpg` | bathroom | ACABAMENTO PREMIUM | BATHROOM_DETAIL | short-detail-bathroom | fade |
| CTA | `Screenshot_20260622_063108_Chrome.jpg` | cta | Agende sua visita | CTA_FINAL | stable-cta-frame | fadeblack |

## Comparacao Com V3

- A V3 dependia de deteccao por nome/caption e podia classificar muitas imagens como `detail`.
- A V3.1 usa `type` explicito nesta primeira POC, evitando repeticao de `slow-detail-drift`.
- A V3.1 aplica movimentos com intencao por ambiente.
- O CTA final e mais estavel e mais separado da sequencia de fotos.
- O zoom foi reduzido para diminuir tremor e microdrift.

## Problemas Encontrados

- Ainda depende de classificacao manual nesta POC.
- Nao havia `input/audio/music.mp3`, portanto o video foi exportado sem trilha.
- Fotos horizontais e verticais precisam de tratamento melhor de crop para producao.
- O render com FFmpeg e pesado para rodar sincronicamente em ambiente serverless.

## Pendencias Para V3.1 Real

- Classificacao automatica visual.
- Selecao automatica das melhores 6 a 8 imagens.
- Narrativa por perfil: alto padrao, vazio, lancamento, locacao e comercial.
- Biblioteca de trilhas licenciadas ou musica padrao segura.
- Worker assincrono para render.
- Preview de frames antes de gerar.

## Conclusao

Esta V3.1 experimental supera a V3 em narrativa e controle de movimento. Ela ainda nao e produto, mas prova que o modo Carrossel Inteligente pode evoluir para uma alternativa previsivel, barata e visualmente superior ao slideshow basico.
