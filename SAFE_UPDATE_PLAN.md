# Safe Update Plan

Data: 2026-05-27

Objetivo: plano seguro para migrar o SmartCorretorAI dos templates antigos/[OFF] para os novos templates padronizados do Creatomate, sem quebrar login, geracao textual, upload ou renderizacao.

Este documento e apenas um plano. Nenhuma alteracao de codigo foi aplicada durante esta auditoria.

## Principios

1. Nao alterar login/autenticacao durante a migracao de templates.
2. Nao deletar templates `[OFF]` ate validar o novo fluxo em producao.
3. Nao remover a geracao textual `gerar-campanha`.
4. Migrar primeiro catalogo e backend, depois interface.
5. Manter rollback simples para reativar IDs antigos se necessario.
6. Preferir preenchimento direto dos campos padronizados antes de acionar IA.

## Fase 0: Congelar Estado Atual

Antes de qualquer mudanca:

1. Exportar ou registrar a lista completa de templates do Creatomate.
2. Manter os templates `[OFF]` no Creatomate.
3. Registrar quais IDs antigos ainda existem no codigo.
4. Confirmar que a geracao textual continua funcionando sem formatos selecionados.
5. Confirmar que upload de fotos continua autenticado.

## Fase 1: Criar Catalogo Novo De Templates

Criar uma fonte unica da verdade para templates, com esta estrutura conceitual:

```ts
{
  id: "template_id",
  nome: "Card Imobiliario Premium 4x5",
  familia: "Card Imobiliario Premium",
  categoria: "banner",
  formato: "4x5",
  tamanho: "1080x1350",
  ativo: true,
  perfil: ["corretor"]
}
```

O catalogo deve separar:

- templates ativos novos
- templates legados
- templates `[OFF]`

Os `[OFF]` podem permanecer documentados, mas nao devem aparecer como opcao ativa na interface.

## Fase 2: Atualizar Interface De Formatos

Atualizar a secao "Formatos de conteudo" em `NovaCampanha.jsx` para usar o catalogo novo.

Regras:

1. Mostrar apenas templates ativos.
2. Agrupar por familia e formato.
3. Nao exibir IDs antigos/[OFF].
4. Manter formatos opcionais.
5. Permitir geracao textual sem selecionar template.

## Fase 3: Atualizar Backend `gerar-banners`

Atualizar a lista `TEMPLATES` da Edge Function com os novos IDs ativos.

Regras:

1. Aceitar somente IDs do catalogo ativo.
2. Manter IDs antigos como legado temporario apenas se houver necessidade de rollback.
3. Nunca selecionar template `[OFF]` automaticamente.
4. Retornar erro claro se o frontend enviar ID desativado.

## Fase 4: Preenchimento Direto Dos Campos Padronizados

Antes da IA montar qualquer `modification`, criar uma etapa deterministica:

```txt
headline_main.text = "Oportunidade"
sale_badge.text = "À Venda"
price_label.text = "A partir de"
features_title.text = "Diferenciais"
property_price.text = preco formatado
property_description.text = descricao resumida
property_image_01.source = fotos[0]
property_image_02.source = fotos[1]
property_image_03.source = fotos[2]
feature_01.text = diferencial/atributo 1
feature_02.text = diferencial/atributo 2
feature_03.text = diferencial/atributo 3
```

Depois disso:

1. A IA pode preencher apenas campos nao padronizados.
2. O sanitizador continua como camada de seguranca.
3. O validador continua impedindo propriedades inexistentes.

## Fase 5: Tratar Campos Opcionais Do Corretor

Manter a regra ja adotada:

```txt
sem avatar = REMOVER_ELEMENTO
sem logo = REMOVER_ELEMENTO
sem email = REMOVER_ELEMENTO
sem WhatsApp = REMOVER_ELEMENTO
sem site = REMOVER_ELEMENTO
sem Instagram = REMOVER_ELEMENTO
```

Quando `REMOVER_ELEMENTO` for usado:

- enviar string vazia
- usar `.track = false` se o elemento suportar
- nunca usar placeholder ficticio

## Fase 6: Remover Chave Do Creatomate Do Frontend

O frontend ainda faz polling direto no Creatomate com chave hardcoded.

Plano seguro:

1. Criar endpoint backend para consultar status dos renders.
2. Frontend chama apenas o backend autenticado.
3. Backend usa `CREATOMATE_API_KEY` via `Deno.env.get`.
4. Remover a chave hardcoded do frontend somente depois de validar o proxy.

Essa fase deve ser separada da troca de templates para reduzir risco.

## Fase 7: Testes Antes De Deploy

Testes minimos:

1. Gerar campanha sem selecionar template.
2. Gerar campanha com um unico template novo.
3. Gerar campanha com varios formatos da mesma familia.
4. Gerar campanha sem foto de perfil do corretor.
5. Gerar campanha sem logo.
6. Gerar campanha sem WhatsApp.
7. Gerar campanha com acentos em bairro, cidade e diferenciais.
8. Testar F5 na pagina logada.
9. Testar upload de fotos.
10. Testar render `succeeded`.
11. Testar render `failed`.
12. Testar envio de ID antigo/[OFF] e confirmar erro controlado.

## Fase 8: Deploy

Sequencia recomendada:

1. Deploy da Edge Function `gerar-banners`.
2. Validar logs no Supabase.
3. Deploy do frontend no servidor do `smartcorretor.com`.
4. Testar com um usuario real.
5. Manter templates `[OFF]` por alguns dias.
6. Remover ou arquivar templates antigos somente depois de estabilidade confirmada.

## Riscos E Mitigacoes

| Risco | Mitigacao |
| --- | --- |
| Login quebrar | Nao tocar em `auth-context.jsx` nem `supabase.js` nesta migracao |
| Geracao textual parar | Manter `gerar-campanha` isolada |
| Template novo rejeitado | Atualizar catalogo frontend e backend juntos |
| Template `[OFF]` aparecer | Filtrar por `ativo: true` |
| Placeholder em ingles aparecer | Preenchimento direto + sanitizador |
| Render falhar por campo inexistente | Continuar buscando elementos reais do template antes do render |
| Chave Creatomate exposta | Criar proxy de polling no backend |
| Rollback dificil | Manter IDs antigos documentados e templates `[OFF]` intactos |

## Criterio De Sucesso

A migracao pode ser considerada segura quando:

1. Todos os templates novos aparecem corretamente na interface.
2. Nenhum template `[OFF]` aparece para o usuario.
3. Os campos padronizados sao preenchidos diretamente.
4. A IA nao precisa adivinhar nomes principais.
5. Renders funcionam em todos os formatos planejados.
6. Login, upload e geracao textual continuam iguais.

## Conclusao

O caminho mais seguro e tratar os novos templates como contrato fixo. A descoberta dinamica e a IA continuam uteis, mas devem virar fallback.

Assim, a geracao fica mais previsivel, os templates brasileiros ganham consistencia e o risco de placeholders antigos aparecerem cai bastante.
