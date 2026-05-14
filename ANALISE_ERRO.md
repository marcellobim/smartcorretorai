# Análise do Erro Crítico - Geração de Textos

## 🔴 PROBLEMA IDENTIFICADO

A geração de textos falha em background e o status muda para 'erro' após ~3 segundos.

## 🔍 ANÁLISE DO CÓDIGO

### 1. **Fluxo de Geração (generateController.js)**

**Linha 173-215**: O processo de geração acontece em background após retornar resposta 202 ao cliente:

```javascript
res.status(202).json({ success: true, campaign: campanha, message: 'Seus anúncios estão sendo criados' })

// ── Geração em background ────────────────────────────────────
try {
  // Upload fotos
  let fotosUrls = []
  if (fotosBase64?.length) {
    fotosUrls = await uploadFotos(fotosBase64, campanha.id)
    // ...
  }

  const textos = await gerarTextosCampanha(req.body)  // ← AQUI PODE FALHAR

  await supabase
    .from('campaigns')
    .update({
      status: 'concluido',
      titulo: textos.titulo_campanha || titulo,
      textos_gerados: textos.textos,
      updated_at: new Date().toISOString(),
    })
    .eq('id', campanha.id)
} catch (procErr) {
  console.error('=== erro geracao === anúncios:', procErr.message)  // ← ERRO LOGADO

  // Devolve crédito avulso se a geração falhou
  if (usarAvulso) {
    await supabase
      .from('profiles')
      .update({ creditos_avulsos: avulsosDisponiveis, updated_at: new Date().toISOString() })
      .eq('id', user.id)
  }

  await supabase
    .from('campaigns')
    .update({ status: 'erro', updated_at: new Date().toISOString() })  // ← STATUS VIRA 'ERRO'
    .eq('id', campanha.id)
}
```

### 2. **Serviço Claude (claude.js)**

**Linha 197-202**: A chamada à API Anthropic:

```javascript
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-6',  // ← MODELO PODE NÃO EXISTIR
  max_tokens: 6000,
  thinking: { type: 'adaptive' },  // ← PARÂMETRO PODE NÃO SER SUPORTADO
  messages: [{ role: 'user', content: userContent }],
})
```

### 3. **Polling no Frontend (NovaCampanha.jsx)**

**Linha 637-656**: O frontend faz polling a cada 3 segundos:

```javascript
pollRef.current = setInterval(async () => {
  try {
    const res = await api.get(`/generate/campaign/${id}/status`)
    const camp = res.campaign
    if (camp.status === 'concluido') {
      clearInterval(pollRef.current)
      setResultado(camp)
      // ...
    } else if (camp.status === 'erro') {  // ← DETECTA ERRO
      clearInterval(pollRef.current)
      toast.error('Ocorreu um erro ao gerar. Tente novamente.')
      setFase('form')
    }
  } catch { /* ignora */ }
}, 3000)  // ← POLLING A CADA 3 SEGUNDOS
```

## 🐛 CAUSAS PROVÁVEIS

### 1. **Modelo Claude Inválido**
- O modelo `'claude-sonnet-4-6'` pode não existir
- Modelos válidos da Anthropic: `claude-3-5-sonnet-20241022`, `claude-3-opus-20240229`, etc.

### 2. **Parâmetro `thinking` Não Suportado**
- O parâmetro `thinking: { type: 'adaptive' }` pode não ser suportado pela versão do SDK
- Esse parâmetro é experimental e pode causar erro

### 3. **API Key Inválida ou Ausente**
- `ANTHROPIC_API_KEY` pode não estar configurada no Railway
- Conforme CLAUDE.md linha 71: "Adicionar env vars no Railway Dashboard"

### 4. **Timeout ou Limite de Tokens**
- A geração pode estar excedendo o tempo ou tokens disponíveis
- Com fotos (vision), o processamento é mais pesado

### 5. **Erro no Parse do JSON**
- Linha 207: `JSON.parse(jsonStr)` pode falhar se a resposta não for JSON válido

## ✅ SOLUÇÕES

### 1. **Corrigir o Modelo Claude**
Trocar `'claude-sonnet-4-6'` por um modelo válido como `'claude-3-5-sonnet-20241022'`

### 2. **Remover Parâmetro `thinking`**
Remover ou tornar opcional o parâmetro experimental

### 3. **Adicionar Tratamento de Erro Detalhado**
Logar o erro completo (não apenas `.message`) para debug

### 4. **Verificar Variáveis de Ambiente**
Garantir que `ANTHROPIC_API_KEY` está configurada no Railway

### 5. **Adicionar Timeout e Retry**
Implementar timeout e retry logic para chamadas longas

## 🎯 PRÓXIMOS PASSOS

1. ✅ Corrigir o modelo Claude em `claude.js`
2. ✅ Remover/ajustar parâmetro `thinking`
3. ✅ Melhorar logging de erros
4. ⚠️ Verificar env vars no Railway (usuário precisa fazer)
5. ✅ Adicionar tratamento de erro mais robusto
