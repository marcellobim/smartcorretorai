# Validacao UX Fase 4.2 - Experiencia do Corretor

## Objetivo

Validar a experiencia visual da Nova Campanha apos o ajuste didatico do SmartCampaignSelector, olhando a tela como um corretor que nunca viu o sistema.

## Ambiente

Tela validada:

`http://127.0.0.1:5173/nova-campanha`

Observacao:

- validacao feita em ambiente local com sessao simulada para permitir acesso a rota autenticada;
- nao houve alteracao de codigo;
- nao houve commit;
- nao houve deploy;
- nao houve migration.

## Screenshots

Screenshots capturados:

- `screenshots/validacao-ux-fase4-2-full.png`
- `screenshots/validacao-ux-fase4-2-cards-topo.png`
- `screenshots/validacao-ux-fase4-2-cards-meio.png`

## Checklist objetivo

### 1. Os 6 cards aparecem claramente diferenciados?

Parcialmente.

Os 6 cards existem e os nomes sao distintos:

- Venda Rapida;
- Luxo Premium;
- Lancamento;
- Minha Casa Minha Vida;
- Airbnb / Temporada;
- Comercial.

Mas visualmente os cards usam estrutura, cor e entregaveis muito parecidos. A principal diferenciacao vem do titulo, descricao, beneficios e dica, nao tanto do visual.

### 2. O corretor entende imediatamente qual campanha escolher?

Sim, para a escolha principal.

Os nomes comerciais sao bons e autoexplicativos:

- Venda Rapida indica urgencia e leads;
- Luxo Premium indica alto padrao;
- Lancamento indica pre-venda/obra/planta;
- Minha Casa Minha Vida indica financiamento e entrada;
- Airbnb / Temporada indica experiencia e reserva;
- Comercial indica sala, loja, terreno e B2B.

O corretor entende o tipo de campanha pela nomenclatura e pela descricao curta.

### 3. O bloco `Voce recebera` esta facil de entender?

Sim, mas esta pesado.

O bloco explica bem os entregaveis, porem ocupa muito espaco dentro de cada card.

### 4. O bloco explica o que e, onde usar e para que serve?

Sim.

Foi confirmado que os cards exibem:

- nome do entregavel, como Banner Feed, Story, Carrossel, Video/Reels, Texto IA e WhatsApp;
- `Onde usar`;
- `Serve para`.

Isso ajuda o corretor iniciante a entender o valor de cada formato.

### 5. O custo em creditos esta visivel e compreensivel?

Sim.

O custo aparece no bloco `Voce recebera`, com destaque visual em formato de badge.

Observacao:

- no plano demonstrativo, Venda Rapida aparece com `0 creditos`, o que faz sentido para a demonstracao;
- campanhas bloqueadas aparecem com custo do modo atual, mas tambem com badge de plano pago.

### 6. Existe excesso de texto?

Sim.

Os cards ficaram muito didaticos, mas tambem extensos. Em desktop ainda e utilizavel, mas a leitura exige bastante rolagem.

O excesso vem principalmente de:

- repetir `Onde usar` e `Serve para` em todos os entregaveis;
- repetir Texto IA e WhatsApp em todos os cards;
- manter beneficios alem do bloco didatico e da dica.

### 7. Existe informacao repetida?

Sim.

As explicacoes de:

- Banner Feed;
- Story;
- Carrossel;
- Video/Reels;
- Texto IA;
- WhatsApp;

sao iguais entre campanhas. Isso e didatico, mas repetitivo.

### 8. Algum card parece mais confuso que os demais?

Nao exatamente confuso, mas alguns ficam mais densos.

Mais densos:

- Luxo Premium, por combinar premium, video e diferenciais;
- Lancamento, por misturar expectativa, stories, carrossel e pre-venda;
- Airbnb / Temporada, por ter foco em experiencia e formatos de video.

Mais claros:

- Venda Rapida;
- Minha Casa Minha Vida;
- Comercial.

### 9. Algum card parece longo demais para mobile?

Sim.

Todos tendem a ficar longos no mobile, porque cada card pode conter:

- descricao;
- custo;
- varios entregaveis detalhados;
- dica;
- beneficios;
- botao.

No mobile, a experiencia provavelmente exigira muita rolagem antes de comparar todas as campanhas.

### 10. A experiencia parece excelente, boa, regular ou confusa?

Boa.

Motivo:

- a intencao de cada campanha esta clara;
- os entregaveis estao bem explicados;
- o corretor iniciante entende melhor o que vai receber;
- nao aparecem termos tecnicos.

Nao chega a excelente porque:

- ha excesso de texto;
- ha repeticao entre cards;
- a comparacao entre campanhas fica mais cansativa;
- mobile tende a ficar longo.

## Termos tecnicos

Nao foram encontrados na tela renderizada:

- `template_id`;
- `Creatomate`;
- `GPT`;
- `UUID`.

## selectedTemplates e payload

Confirmacao por inspecao:

- `selectedTemplates` nao foi alterado;
- o payload de geracao nao foi alterado;
- o backend nao foi alterado;
- a selecao de campanha continua preenchendo `formatosSel` internamente;
- `selectedTemplateIds` continua derivando de `formatosSel`;
- o `CreditSummary` continua usando os templates selecionados internamente.

## Sugestao visual sem alterar codigo agora

Para deixar a experiencia mais leve, a melhor evolucao seria:

1. Manter o card compacto com:
   - titulo;
   - descricao;
   - pecas;
   - creditos;
   - 2 ou 3 entregaveis principais;
   - botao.

2. Colocar detalhes em:
   - accordion;
   - `Ver detalhes`;
   - painel expandido apenas no card selecionado;
   - area abaixo do catalogo mostrando detalhes da campanha escolhida.

3. Evitar repetir Texto IA e WhatsApp completos em todos os cards. Mostrar como linha fixa:

```text
Todos os pacotes incluem textos IA e sugestao de mensagem para WhatsApp.
```

4. Exibir `Onde usar` e `Serve para` apenas quando o usuario expandir o card.

## Resposta final da validacao

Se eu fosse um corretor novo, eu entenderia qual campanha escolher sem assistir treinamento?

SIM
