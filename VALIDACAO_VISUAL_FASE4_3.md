# VALIDAÇÃO VISUAL FASE 4.3 — CRÉDITOS INTELIGENTES

Data: 2026-05-31

## Contexto da validação

Tela validada:

- `/nova-campanha`

Usuário autenticado:

- `bbqbim@gmail.com`

Estado do usuário durante a validação:

- Plano demonstrativo / gratuito.

Observação importante:

Como o usuário autenticado está no plano demonstrativo, a tela substitui o `Resumo de Créditos` global pelo bloco `Plano demonstrativo`. A validação de créditos foi possível dentro da nova aba `Monte Sua Campanha`, que exibe saldo simulado, consumo estimado e saldo após geração.

## Screenshots capturados

- `screenshots/validacao-fase4-3-campanhas-recomendadas.png`
- `screenshots/validacao-fase4-3-campanhas-recomendadas-selecionada.png`
- `screenshots/validacao-fase4-3-monte-sua-campanha.png`
- `screenshots/validacao-fase4-3-resumo-creditos.png`

## 1. Abas

Resultado: aprovado com ressalva visual.

Foram encontradas as duas abas:

- 🚀 Campanhas Recomendadas
- 🎯 Monte Sua Campanha

As abas existem e são compreensíveis conceitualmente. Porém, na largura atual do navegador embutido, a área útil ficou muito estreita por causa da sidebar fixa, o que comprime bastante os cards e dificulta a leitura. Em desktop largo, a estrutura deve funcionar melhor. Em viewport estreita/mobile, precisa de revisão visual.

## 2. Aba Campanhas Recomendadas

Resultado: aprovado funcionalmente, com ressalva de layout estreito.

Confirmações:

- Os 6 cards continuam presentes:
  - Venda Rápida
  - Luxo Premium
  - Lançamento
  - Minha Casa Minha Vida
  - Airbnb / Temporada
  - Comercial
- No plano demonstrativo, apenas a campanha permitida fica selecionável.
- As demais campanhas aparecem bloqueadas para planos pagos.
- Ao selecionar a campanha disponível, a UI muda para `Campanha selecionada`.
- Os cards mostram custo estimado, saldo atual e saldo após gerar.

Sobre `selectedTemplates`:

- A seleção visual continua acionando a lógica interna de campanha.
- O payload não foi disparado nesta validação.
- Não houve alteração visual indicando quebra de seleção interna.

## 3. Aba Monte Sua Campanha

Resultado: aprovado funcionalmente, com ressalva visual.

Confirmações:

- O usuário consegue entrar no modo manual.
- Os formatos aparecem com botão `Selecionar`.
- Cada formato mostra custo individual em créditos.
- Ao selecionar um formato, o botão muda para `Desmarcar`.
- O consumo total mudou em tempo real:
  - antes: `0`
  - depois de selecionar um banner: `10`
- O saldo após geração mudou corretamente:
  - antes: `150`
  - depois de selecionar um banner de 10 créditos: `140`

Experiência para o corretor:

- A lógica de escolher formatos manualmente está clara.
- O conceito de custo individual por formato aparece bem.
- A tela fica carregada em largura estreita, principalmente porque sidebar + cards deixam pouca área útil.

## 4. Resumo de Créditos

Resultado: parcialmente validado.

Validado dentro da aba `Monte Sua Campanha`:

- Saldo atual
- Consumo estimado
- Saldo após gerar
- Recalculo em tempo real

Não validado no bloco global:

- O componente global `Resumo de creditos` não apareceu para este usuário porque o plano demonstrativo exibe o bloco `Plano demonstrativo`.

Aviso de saldo insuficiente:

- Não apareceu no cenário testado porque a seleção ficou abaixo do saldo simulado.
- A estrutura de aviso existe no frontend, mas não foi visualmente disparada nesta validação.

Sugestão de economia:

- No resumo global, não foi validada visualmente por causa do plano demonstrativo.
- No modo manual, há sugestão quando o saldo fica insuficiente.

## 5. Termos técnicos proibidos

Resultado: aprovado.

Não foram encontrados na tela:

- `template_id`
- `UUID`
- `Creatomate`
- `GPT`
- `OpenAI`

## 6. UX

### Está claro que o usuário compra créditos e usa como quiser?

Parcialmente.

A aba manual comunica bem a ideia de escolher formatos e acompanhar custo. A copy poderia reforçar melhor, em fase futura, que os créditos são livres para uso entre campanhas prontas e montagem manual.

### Está claro que ele pode usar campanha pronta ou montar a própria?

Sim.

As duas abas deixam essa diferença clara:

- Campanha pronta: `Campanhas Recomendadas`
- Escolha livre: `Monte Sua Campanha`

### A tela ficou poluída?

Moderadamente.

Em largura desktop, a organização tende a funcionar. No viewport estreito capturado, a tela ficou comprimida e difícil de ler.

### Mobile parece viável?

Ainda não.

Na validação com largura aproximada de 415px, a sidebar permanece ocupando grande parte da tela e o conteúdo fica espremido. Para mobile real, a experiência precisa de ajuste futuro com sidebar recolhida, layout em uma coluna e cards com detalhes expansíveis.

## Conclusão

A Fase 4.3 está funcionalmente validada:

- As duas abas existem.
- Campanhas recomendadas continuam disponíveis.
- Seleção manual funciona.
- Custos individuais aparecem.
- Consumo total e saldo após geração mudam em tempo real.
- Termos técnicos não aparecem para o cliente.

Principal risco antes de avançar:

- UX responsiva/mobile. A experiência fica comprimida em largura estreita e precisa de refinamento visual antes de considerar a tela pronta para uso amplo em celular.

Recomendação:

- Não corrigir ainda dentro desta validação.
- Próximo passo sugerido: planejar uma etapa curta de refinamento responsivo para a Nova Campanha, especialmente sidebar mobile, largura dos cards e detalhes expansíveis.
