# Ajuste Planos - Modelo de Creditos

## Objetivo

Migrar somente a pagina `/planos` para o modelo comercial atual baseado em creditos, sem alterar Stripe, backend, APIs, geracao, `NovaCampanha.jsx`, migrations, deploy ou a Fase 4 do catalogo.

## Arquivo alterado

- `frontend/src/pages/Planos.jsx`

## Modelo antigo removido

Foram removidos da pagina `/planos`:

- Teste Gratis como plano de 1 anuncio.
- Avulso 5 anuncios.
- Avulso 10 anuncios.
- Start com 15 anuncios.
- Pro com 35 anuncios.
- Imobiliaria com 80 anuncios.
- Regras de anuncios mensais.
- Regras de anuncios avulsos.
- Copy de anuncios que nao expiram.
- Regra de multiplos logins apenas no plano Imobiliaria.

## Novo modelo exibido

### Planos

- START: 1.000 creditos por ciclo.
- PRO: 2.500 creditos por ciclo.
- ELITE: 6.000 creditos por ciclo.

### Recargas

- 500 creditos: R$ 59.
- 1.000 creditos: R$ 99.
- 2.000 creditos: R$ 179.

## Regras de copy adicionadas

- Textos IA gratuitos.
- Banners consomem menos creditos.
- Videos consomem mais creditos.
- Creditos da assinatura renovam a cada ciclo.
- Creditos avulsos expiram em 180 dias.
- O usuario escolhe os formatos e usa os creditos de forma inteligente.

## Validacao tecnica

Busca feita em `Planos.jsx` confirmou que nao restam referencias ao modelo antigo na pagina:

- anuncios;
- avulso5;
- avulso10;
- Imobiliaria;
- mensalidade.

## Build

Comando executado:

```bash
npm run build
```

Resultado: passou.

Observacao: Vite exibiu apenas o aviso conhecido de chunk maior que 500 kB apos minificacao.

## Validacao visual

A pagina `/planos` foi aberta localmente em:

`http://127.0.0.1:5173/planos`

Pontos a validar visualmente:

- Hero da pagina mostra "Creditos de marketing".
- Planos START, PRO e ELITE aparecem em cards premium.
- Recargas aparecem separadas abaixo dos planos.
- Regras importantes usam copy de creditos.
- Nao aparecem planos antigos baseados em anuncios.

## Nao alterado

- Stripe.
- Backend.
- Edge Functions.
- APIs.
- Geracao.
- `NovaCampanha.jsx`.
- Migration.
- Deploy.
- Fase 4 do catalogo.
