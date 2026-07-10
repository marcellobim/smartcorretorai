# SMART VIDEO E SUPER CARROSSEL INTELIGENTE — CHECKPOINT UI

Data: 2026-07-09

## Smart Video

- Melhora um vídeo já gravado.
- Aceita vídeo de até 3 minutos.
- Coleta Venda ou Locação.
- Coleta tipo do imóvel.
- Coleta UF e bairro.
- Coleta tipologia.
- Permite até 3 destaques.
- Coleta estilo da música.
- Coleta CTA.
- Permite telefone opcional.
- Exibe conferência final.
- Exibe entrega visual em celular 9:16.
- Geração real ainda não integrada.

## Super Carrossel Inteligente

- Recebe de 1 a 20 imagens.
- Usa a primeira imagem como capa.
- Permite organização visual das imagens.
- Usa o mesmo fluxo comercial do Smart Video.
- Gera futuramente um vídeo vertical pelo motor interno.
- Exibe entrega visual em celular 9:16.
- Geração real ainda não integrada.

## Separação oficial dos produtos

- Studio Hero cria vídeos novos.
- Super Carrossel Inteligente cria vídeo usando imagens.
- Smart Video melhora vídeo gravado pelo corretor.
- Não existe mais sobreposição com “Finalizar meu vídeo”.

## Arquivos criados

- `frontend/src/pages/SmartVideo.jsx`
- `docs/checkpoints/2026-07-09-final-do-dia.md`
- Artefatos locais de validação e render em `.codex/tmp`, `core/smart-motion-engine/output` e `experiments/home-references`

## Arquivos alterados

- `frontend/src/App.jsx`
- `frontend/src/pages/Dashboard.jsx`
- `frontend/src/pages/StudioHero.jsx`

## Resumo das alterações

- Smart Video recebeu o fluxo completo de chat visual, sem integração real de geração.
- Smart Video passou a ter upload local de vídeo, validações de formato e duração, dados comerciais, resumo e tela de entrega com moldura de celular.
- Dashboard passou a exibir o card do Smart Video.
- App passou a registrar a rota `/smart-video`.
- Studio Hero teve o antigo quarto modo de vídeo substituído por `Super Carrossel Inteligente`.
- Studio Hero deixou de posicionar o quarto modo como melhoria de vídeo gravado.
- Super Carrossel Inteligente recebeu o fluxo visual completo de chat para imagens do imóvel usando o identificador `studio_hero_image_to_video`.
- Smart Motion Engine evoluiu nas fases de contrato, mock, render local, música e comunicação comercial.
- Foram gerados vídeos locais de validação do Smart Motion Engine para comparação e aprovação visual.

## Principais decisões de UX

- Manter uma pergunta por vez em Smart Video e Super Carrossel Inteligente.
- Reutilizar o padrão de chat, progresso, botões, chips, resumo e entrega em celular.
- Limitar destaques a no máximo 3 para evitar comunicação poluída.
- Usar linguagem comercial e simples para o corretor.
- Exibir entregas futuras em moldura de celular vertical 9:16, sem preview técnico falso.
- Separar claramente Smart Video de Studio Hero: Smart Video melhora vídeo gravado; Studio Hero cria vídeos a partir de imagens.

## Principais decisões de arquitetura

- Manter os novos fluxos visuais sem backend, Supabase, Smart Tokens, jobs ou upload real.
- Preservar o identificador `studio_hero_image_to_video` para o Super Carrossel Inteligente.
- Preparar payloads locais apenas para validação de estado em desenvolvimento.
- Manter o renderer e o Smart Motion Engine desacoplados da UI visual.
- Evitar alteração dos Produtos 1 e 2.

## Componentes reutilizados

- `Button`
- Estrutura visual de chat do Smart Video
- Padrão de barra de progresso
- Chips de seleção
- Resumo visual
- Moldura de celular para entrega
- Utilitários equivalentes de máscara de telefone, normalização de bairro e labels de tipologia

## Rotas adicionadas

- `/smart-video`

## Rotas validadas

- `/dashboard`
- `/hero`
- `/studio-hero`
- `/smart-video`
- `/nova-campanha`

## Pendências técnicas

- Conectar Smart Video ao motor interno.
- Conectar Super Carrossel ao motor interno.
- Upload real.
- Geração.
- Renderização.
- Polling.
- Download.
- Smart Tokens.
- Erros e estornos.
- Testes reais de vídeo.
