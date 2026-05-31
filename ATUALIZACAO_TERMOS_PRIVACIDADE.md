# Atualizacao Termos e Privacidade

## Objetivo

Atualizar Termos de Uso, Politica de Privacidade e aceite do cadastro para o modelo atual de creditos do SmartCorretorAI.

## Arquivos alterados

- `frontend/src/pages/TermosDeUso.jsx`
- `frontend/src/pages/Privacidade.jsx`
- `frontend/src/pages/RegisterPage.jsx`

## O que foi atualizado

### Termos de Uso

O arquivo foi reestruturado em linguagem clara e simples para cobrir:

- aceite pleno ao criar conta, usar o sistema, gerar campanhas, assinar planos ou comprar creditos;
- descricao atual da plataforma;
- campanha demonstrativa gratuita unica;
- recursos premium bloqueados no demonstrativo;
- planos START, PRO e ELITE por creditos;
- recargas de 500, 1.000 e 2.000 creditos;
- creditos de assinatura por ciclo;
- creditos avulsos com validade de 180 dias;
- creditos sem valor monetario fora da Plataforma;
- creditos nao transferiveis entre contas;
- creditos consumidos nao reembolsaveis, salvo obrigacao legal ou decisao expressa;
- creditos avulsos sujeitos a expiracao conforme politica vigente;
- protecao para evolucao do produto: campanhas, formatos, templates, recursos e funcionalidades podem ser adicionados, removidos, substituidos ou aperfeicoados;
- composicao dos materiais entregues pode evoluir sem obrigacao de manter exatamente os mesmos formatos atuais;
- renovacao, cancelamento e expiracao;
- revisao obrigatoria de conteudo gerado por IA;
- texto explicito de que conteudos gerados por IA podem conter imprecisoes, interpretacoes incorretas, omissoes ou informacoes desatualizadas;
- nova secao `Informacoes de Mercado e Ferramentas de Apoio`;
- aviso de que informacoes de mercado, dados publicos e pesquisas automatizadas sao apenas informativas;
- aviso de que essas informacoes nao substituem PTAM, laudo, avaliacao profissional, analise juridica ou validacao por especialista;
- uso promocional de materiais gerados pela SmartCorretorAI com preservacao de dados pessoais quando aplicavel;
- ausencia de garantia de resultado comercial;
- limitacao de responsabilidade.

### Politica de Privacidade

A Politica foi atualizada para cobrir:

- dados de cadastro, perfil, imoveis, fotos, arquivos e materiais gerados;
- uso de dados para geracao de campanhas por IA;
- texto explicito de que conteudos gerados por IA podem conter imprecisoes, interpretacoes incorretas, omissoes ou informacoes desatualizadas;
- nova secao sobre informacoes de mercado, dados publicos, pesquisas automatizadas e ferramentas de apoio;
- reforco de que informacoes de mercado nao substituem PTAM, laudo ou avaliacao profissional;
- compartilhamento com provedores de IA, renderizacao, pagamentos, infraestrutura e redes sociais;
- uso promocional de exemplos de campanhas e materiais gerados;
- regra para preservar identidade do usuario em divulgacoes;
- nao exposicao de nome, telefone, e-mail, CRECI, endereco especifico, imagem pessoal, logotipo ou identidade visual sem anonimizar, mascarar ou obter autorizacao especifica quando aplicavel;
- registros de planos, creditos, recargas, consumo e vencimentos;
- direitos do titular conforme LGPD.

### Cadastro

O cadastro foi ajustado para:

- remover a promessa de `7 dias gratis`;
- usar `1 campanha demonstrativa gratuita, sem cartao de credito`;
- substituir links legais `href="#"` por rotas reais:
  - `/termos`;
  - `/privacidade`;
- ampliar o texto de aceite para uso do sistema, geracao de campanhas e contratacao de planos/recargas.

## Termos antigos removidos ou substituidos

- modelo antigo de anuncios mensais;
- avulsos antigos sem expiracao;
- plano Imobiliaria como plano comercial;
- 7 dias gratis;
- links legais sem destino real;
- fornecedor de IA antigo citado nominalmente.

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
- Edge Functions;
- Stripe;
- Supabase;
- migrations;
- deploy;
- geracao de campanhas;
- creditos reais;
- NovaCampanha.

## Observacoes

Esta atualizacao melhora alinhamento comercial e legal com o modelo atual de creditos, mas ainda e recomendavel uma revisao juridica formal antes de producao ampla ou cobranca real.
