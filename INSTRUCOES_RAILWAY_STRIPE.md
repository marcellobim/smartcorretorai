# Instruções para Atualizar Variáveis Stripe no Railway

## Contexto
A STRIPE_SECRET_KEY (sk_live_) já foi atualizada manualmente no Railway.
Agora é necessário atualizar a STRIPE_PUBLISHABLE_KEY para o ambiente Live.

## Passos para Atualizar no Railway

### 1. Atualizar STRIPE_PUBLISHABLE_KEY

**Chave Live a ser configurada:**
```
pk_live_51TVKsNDETDGav5vyzSNRlmIuRIwiLZlWugwijWWLmPVh1h0cnW6PzBLVrjcKRDSbIBxCpRtXODfYKnMYZ8H3Jf7700zMMACfSI
```

**Opção 1: Via Dashboard do Railway (Recomendado)**
1. Acesse https://railway.app/
2. Selecione seu projeto
3. Vá para a aba "Variables"
4. Localize ou adicione a variável `STRIPE_PUBLISHABLE_KEY`
5. Cole o valor: `pk_live_51TVKsNDETDGav5vyzSNRlmIuRIwiLZlWugwijWWLmPVh1h0cnW6PzBLVrjcKRDSbIBxCpRtXODfYKnMYZ8H3Jf7700zMMACfSI`
6. Salve as alterações

**Opção 2: Via CLI do Railway**

Se você tiver o Railway CLI instalado e configurado, execute:

```bash
railway variables --set STRIPE_PUBLISHABLE_KEY=pk_live_51TVKsNDETDGav5vyzSNRlmIuRIwiLZlWugwijWWLmPVh1h0cnW6PzBLVrjcKRDSbIBxCpRtXODfYKnMYZ8H3Jf7700zMMACfSI
```

**Nota:** Se você estiver no PowerShell e encontrar erro de política de execução, use:
```bash
cmd /c railway variables --set STRIPE_PUBLISHABLE_KEY=pk_live_51TVKsNDETDGav5vyzSNRlmIuRIwiLZlWugwijWWLmPVh1h0cnW6PzBLVrjcKRDSbIBxCpRtXODfYKnMYZ8H3Jf7700zMMACfSI
```

### 2. Verificar STRIPE_WEBHOOK_SECRET

**Importante:** Certifique-se de que o `STRIPE_WEBHOOK_SECRET` está configurado para o ambiente Live.

1. Acesse o Dashboard do Stripe: https://dashboard.stripe.com/
2. Vá para "Developers" > "Webhooks"
3. Certifique-se de estar no modo **Live** (não Test)
4. Localize o webhook configurado para sua aplicação Railway
5. Copie o "Signing secret" (começa com `whsec_`)
6. No Railway, configure a variável `STRIPE_WEBHOOK_SECRET` com esse valor

**Se o webhook ainda não existir no modo Live:**
1. Crie um novo webhook endpoint no Stripe (modo Live)
2. URL do endpoint: `https://seu-dominio-railway.up.railway.app/api/webhooks/stripe`
3. Selecione os eventos necessários (ex: `checkout.session.completed`, `payment_intent.succeeded`, etc.)
4. Copie o "Signing secret" gerado
5. Configure no Railway como `STRIPE_WEBHOOK_SECRET`

### 3. Checklist de Variáveis Stripe no Railway

Certifique-se de que todas as seguintes variáveis estão configuradas com valores **Live**:

- [ ] `STRIPE_PUBLISHABLE_KEY` = `pk_live_51TVKsNDETDGav5vyzSNRlmIuRIwiLZlWugwijWWLmPVh1h0cnW6PzBLVrjcKRDSbIBxCpRtXODfYKnMYZ8H3Jf7700zMMACfSI`
- [ ] `STRIPE_SECRET_KEY` = `sk_live_...` (já configurada)
- [ ] `STRIPE_WEBHOOK_SECRET` = `whsec_...` (verificar se é do ambiente Live)

### 4. Após Atualizar

Depois de atualizar as variáveis:
1. O Railway irá automaticamente fazer o redeploy da aplicação
2. Aguarde o deploy ser concluído
3. Teste uma transação real (com cartão de teste do Stripe em modo Live, se disponível)
4. Verifique os logs do Railway para confirmar que não há erros relacionados ao Stripe

## Notas Importantes

⚠️ **Atenção:**
- As chaves Live processam transações reais
- Certifique-se de que todos os webhooks estão configurados corretamente
- Mantenha as chaves secretas seguras e nunca as exponha no código frontend
- A `STRIPE_PUBLISHABLE_KEY` pode ser usada no frontend (é pública)
- A `STRIPE_SECRET_KEY` deve permanecer apenas no backend (é privada)

## Referências

- [Railway Documentation](https://docs.railway.app/)
- [Stripe API Keys](https://stripe.com/docs/keys)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)
