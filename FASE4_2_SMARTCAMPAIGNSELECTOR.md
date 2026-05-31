# Fase 4.2 - SmartCampaignSelector Visual

## Objetivo

Transformar o Catalogo Premium Visual em uma experiencia mais orientada a campanhas inteligentes, mantendo tudo apenas no frontend.

## Arquivo alterado

- `frontend/src/pages/NovaCampanha.jsx`

## O que foi implementado

Os 6 cards oficiais foram revisados:

- Venda Rapida;
- Luxo Premium;
- Lancamento;
- Minha Casa Minha Vida;
- Airbnb / Temporada;
- Comercial.

Cada card agora exibe:

- nome da campanha;
- descricao curta;
- beneficios;
- quantidade de pecas;
- custo estimado em creditos;
- bloco `Voce recebera`;
- lista de entregaveis;
- explicacao de cada entregavel;
- secao `Dica SmartCorretorAI`;
- botao `Selecionar campanha`.

## Entregaveis exibidos

O bloco `Voce recebera` resume os formatos de forma comercial:

- banners;
- stories;
- carrosseis;
- videos;
- textos IA.
- WhatsApp.

Os entregaveis sao calculados a partir dos itens de catalogo associados a cada campanha + modo visual selecionado.

## Ajuste didatico dos entregaveis

Cada entregavel passou a explicar:

- o que e;
- onde usar;
- para que serve.

Exemplos de explicacao exibida:

- Banner Feed: usar em Instagram e Facebook para divulgar o imovel no feed e gerar interesse imediato.
- Story: usar em Instagram Stories, Facebook Stories e Status do WhatsApp para aumentar visualizacoes rapidas e gerar contatos.
- Carrossel: usar em Instagram e Facebook para mostrar varios ambientes do imovel em uma unica publicacao.
- Video/Reels: usar em Instagram Reels, TikTok e Facebook Reels para aumentar alcance e criar impacto visual.
- Texto IA: usar em portais, Instagram, Facebook e WhatsApp para publicar com mais qualidade sem escrever do zero.
- WhatsApp: usar em grupos, clientes e leads para compartilhar o imovel rapidamente e iniciar conversas.

## Dica SmartCorretorAI

Cada campanha agora exibe uma recomendacao pratica de uso.

Exemplos:

- Venda Rapida recomenda publicar Stories diariamente e alternar Banners no Feed durante a semana.
- Luxo Premium recomenda abrir a campanha com video premium e reforcar diferenciais com carrosseis.
- Minha Casa Minha Vida recomenda priorizar chamadas simples e envio pelo WhatsApp.

## Creditos

O custo estimado exibido no card usa o custo do modo atual:

- Economica: 40 creditos;
- Premium IA: 200 creditos;
- Completa: 500 creditos.

No plano demonstrativo, a campanha liberada mostra custo visual zero para a demonstracao.

## selectedTemplates

O contrato foi preservado.

Ao selecionar uma campanha:

- o frontend consulta `CAMPAIGN_TEMPLATES`;
- resolve a combinacao campanha + modo;
- preenche internamente `formatosSel`;
- `selectedTemplateIds` continua sendo derivado de `formatosSel`;
- `CreditSummary` continua recebendo `selectedTemplateIds`;
- o backend continua recebendo `selectedTemplates` como antes.

Nao houve alteracao de payload, Edge Functions ou backend.

## Resumo de Creditos

O Resumo de Creditos continua posicionado depois do Catalogo Premium Visual.

Como a selecao da campanha atualiza `formatosSel`, o resumo recalcula os itens selecionados e o custo estimado visual.

## Termos tecnicos

A interface dos cards nao exibe:

- `template_id`;
- UUID;
- Creatomate;
- GPT;
- nomes tecnicos de templates.

Observacao: referencias tecnicas podem existir internamente no codigo, mas nao foram adicionadas na UI.

## Build

Comando executado:

```bash
npm run build
```

Diretorio:

`frontend`

Resultado:

- build passou;
- Vite exibiu apenas o aviso conhecido de chunk maior que 500 kB.

## O que nao foi alterado

- backend;
- Stripe;
- Supabase;
- migrations;
- deploy;
- Edge Functions;
- logica real de creditos;
- payload final de geracao.

## Riscos e proximos cuidados

- a validacao visual autenticada ainda depende de usuario valido;
- o plano demonstrativo ainda usa bloqueio visual/local;
- thumbnails reais e previews animados ainda nao foram implementados;
- a UI antiga de templates permanece oculta como fallback tecnico.

## Conclusao

A Fase 4.2 melhora a experiencia do Catalogo Premium Visual, deixando a selecao mais orientada a campanhas e entregaveis, sem quebrar `selectedTemplates` nem alterar backend.
