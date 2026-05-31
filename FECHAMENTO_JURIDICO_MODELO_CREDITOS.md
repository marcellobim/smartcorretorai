# Fechamento Juridico - Modelo de Creditos

## Data da revisao

31 de maio de 2026

## Objetivo

Encerrar oficialmente a etapa juridica/comercial do SmartCorretorAI para o modelo de creditos, campanha demonstrativa unica e protecoes de uso dos materiais gerados.

## Resumo das alteracoes realizadas

Foram atualizados:

- Termos de Uso;
- Politica de Privacidade;
- texto de aceite no cadastro;
- relatorios de atualizacao e validacao final.

As paginas legais foram alinhadas ao modelo comercial atual:

- START: 1.000 creditos;
- PRO: 2.500 creditos;
- ELITE: 6.000 creditos;
- recargas de 500, 1.000 e 2.000 creditos;
- creditos de assinatura por ciclo;
- creditos avulsos com validade de 180 dias;
- campanha demonstrativa gratuita unica.

## Protecoes adicionadas

### Creditos

Foi incluida clausula informando que:

- creditos nao possuem valor monetario fora da Plataforma;
- creditos nao sao moeda;
- creditos nao sao transferiveis entre contas;
- creditos nao podem ser convertidos em dinheiro;
- creditos consumidos na geracao, renderizacao ou liberacao de materiais nao sao reembolsaveis, salvo obrigacao legal ou decisao expressa da SmartCorretorAI;
- creditos avulsos expiram conforme a politica vigente informada na contratacao.

### Evolucao do produto

Foi incluida clausula informando que:

- a SmartCorretorAI podera adicionar, remover, substituir ou aperfeicoar campanhas, formatos, templates, recursos e funcionalidades ao longo do tempo;
- a composicao dos materiais entregues podera evoluir sem obrigacao de manter exatamente os mesmos formatos, campanhas, templates ou recursos existentes hoje.

### Campanha demonstrativa

Foi incluida regra de que:

- o teste gratuito e 1 campanha demonstrativa gratuita, unica e limitada;
- recursos premium podem ficar bloqueados;
- novas geracoes, recursos premium ou downloads podem exigir plano pago ou compra de creditos.

### IA e informacoes de mercado

Foi incluida protecao informando que:

- conteudos gerados por inteligencia artificial podem conter imprecisoes, interpretacoes incorretas, omissoes ou informacoes desatualizadas;
- informacoes de mercado podem usar dados publicos, pesquisas automatizadas, inteligencia artificial e ferramentas de apoio;
- essas informacoes possuem carater informativo;
- nao substituem PTAM;
- nao substituem laudo tecnico;
- nao substituem avaliacao profissional;
- nao substituem analise juridica, documental ou orientacao de especialista;
- o usuario deve validar as informacoes antes de publicar, apresentar a clientes ou usar em negociacoes.

### Uso promocional

Foi incluida autorizacao para uso de exemplos de campanhas, artes, imagens geradas, layouts, textos e materiais produzidos pela Plataforma para:

- demonstracao;
- portfolio;
- divulgacao;
- treinamento comercial;
- propaganda da propria plataforma.

Tambem foi incluida protecao para preservar dados pessoais identificaveis quando aplicavel.

## Itens cobertos

- modelo antigo de anuncios removido das paginas legais;
- avulsos antigos removidos;
- plano Imobiliaria removido como plano comercial;
- promessa de 7 dias gratis removida;
- links legais do cadastro corrigidos para `/termos` e `/privacidade`;
- aceite ampliado ao criar conta, usar sistema, gerar campanhas, contratar planos ou comprar recargas;
- cancelamento e renovacao cobertos;
- ausencia de garantia de resultado comercial coberta;
- privacidade atualizada para dados, fotos, materiais enviados, IA, pagamentos, creditos e uso promocional;
- build executado com sucesso.

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

## Escopo preservado

Nao foram alterados:

- backend;
- Stripe;
- Supabase;
- migrations;
- Edge Functions;
- NovaCampanha;
- Landing;
- Planos;
- deploy.

## Conclusao

A etapa juridica/comercial do modelo de creditos fica encerrada em checkpoint seguro para revisao e continuidade do produto.

Ainda e recomendavel revisao juridica formal antes de cobranca ampla em producao.
