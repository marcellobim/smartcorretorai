# Roadmap

## Agora

- Checkpoint seguro mantido: `be1213f1c7a6f6c90b418d519c8c3bf496be1849`.
- Sem push.
- Sem deploy.
- Sem commit automatico.
- Produto 3 preservado.
- Creatomate congelado para evolucao do Modo 3.

## Concluido

- Fase 1 Smart Motion Engine: base local Node + FFmpeg.
- Fase 1.5 Smart Motion Engine: modelos visuais internos e base conceitual do Smart Media Engine.
- Outputs locais dos quatro modelos visuais gerados.

## Proximas Fases Recomendadas

### Fase 2 - QA E Preview

- Revisao visual manual dos quatro modelos.
- Ajustar ritmo, CTA e textos com base em observacao real.
- Gerar frames de preview por modelo.
- Definir quais modelos viram previews oficiais.

### Fase 3 - Worker Local

- Criar worker separado do Supabase Edge.
- Receber JSON de job.
- Renderizar MP4.
- Salvar output e report.

### Fase 4 - Integracao Controlada

- Criar tabela de jobs.
- Criar storage/path isolado.
- Criar Edge Functions separadas do Creatomate.
- Integrar frontend somente apos plano e autorizacao.

### Fase 5 - Produto

- Transformar Modo 3 em escolha unica guiada por previews.
- Usuario escolhe por modelo visual, nao por efeito tecnico.
- Validar creditos, limites, seguranca e UX.
