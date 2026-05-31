# Auditoria Teste Demonstrativo - Fase 4.0A

## Objetivo

Auditar a protecao visual do teste gratuito apos a mudanca de posicionamento para campanha demonstrativa unica.

Esta auditoria registra o estado implementado antes do checkpoint da Fase 4.

## Arquivos verificados

- `frontend/src/pages/LandingPage.jsx`
- `frontend/src/pages/NovaCampanha.jsx`

## Landing

### Alteracoes confirmadas

A Landing deixou de vender o teste como periodo gratuito de 7 dias e passou a apresentar a oferta como demonstracao unica.

Textos atuais confirmados:

- `Campanha grátis`
- `Gerar campanha demonstrativa`
- `1 campanha demonstrativa gratuita`
- `Teste o SmartCorretorAI sem cartão e gere sua primeira campanha.`

### Status

Alinhado com a decisao de produto:

- nao vender mais "7 dias gratis";
- posicionar o teste como primeira campanha demonstrativa;
- manter a chamada sem cartao.

## Nova Campanha

### Regra visual do plano demonstrativo

A tela passou a tratar usuario sem plano pago como plano demonstrativo.

Regra atual:

- plano demonstrativo nao usa resumo de creditos;
- mostra aviso de campanha gratuita de demonstracao;
- permite apenas a campanha `Venda Rapida`;
- bloqueia visualmente as demais campanhas;
- exibe badge `Disponível nos planos pagos`;
- apos uso, bloqueia nova geracao pela interface;
- apos resultado, mostra chamada para assinar START, PRO ou ELITE.

## O que o demonstrativo libera

A interface informa que a demonstracao libera:

- textos IA;
- hashtags;
- descricao;
- post;
- roteiro;
- 1 banner feed;
- 1 story;
- 1 carrossel simples.

## O que fica bloqueado

No plano demonstrativo, ficam bloqueadas visualmente as campanhas avancadas:

- Luxo Premium;
- Lancamento;
- Minha Casa Minha Vida;
- Airbnb / Temporada;
- Comercial.

Essas campanhas aparecem como disponiveis nos planos pagos.

## Templates internos do demonstrativo

O plano demonstrativo usa uma lista fixa de formatos internos:

- 1 banner feed;
- 1 story;
- 1 carrossel simples.

O usuario nao ve IDs tecnicos, Creatomate, OpenAI, GPT, UUID ou `template_id`.

## Persistencia do uso demonstrativo

O uso da campanha demonstrativa esta sendo controlado no frontend por `localStorage`, usando uma chave por usuario autenticado.

### Risco

Essa protecao e adequada apenas como camada visual inicial.

Ela nao e suficiente como regra antifraude definitiva porque:

- pode ser limpa no navegador;
- nao impede bypass via chamada direta;
- nao registra uso no banco;
- nao bloqueia server-side.

### Recomendacao futura

Na proxima fase de seguranca, migrar o controle de uso demonstrativo para o Supabase:

- campo ou tabela de uso demonstrativo por usuario;
- bloqueio server-side na Edge Function;
- registro de data, campanha e templates usados;
- resposta clara quando a campanha gratuita ja tiver sido consumida.

## Backend

Nao houve alteracao em:

- Edge Functions;
- Supabase;
- Stripe;
- APIs;
- creditos reais;
- renderizacao;
- fila.

## selectedTemplates

`selectedTemplates` continua sendo a saida final para o backend.

A mudanca visual seleciona campanhas inteligentes, mas a geracao continua recebendo a lista interna de templates como antes.

## Build

O build sera executado no fechamento do checkpoint.

## Conclusao

A protecao demonstrativa esta correta para a etapa visual da Fase 4:

- remove o discurso de 7 dias gratis;
- transforma o teste em uma campanha unica;
- restringe o catalogo no plano demonstrativo;
- preserva o backend e o contrato `selectedTemplates`.

O principal risco restante e que o bloqueio ainda e visual/local. Para producao definitiva, precisa ser reforcado no banco e na Edge Function.
