# 🔴 Plano de Correção - Login Erro 500

## 📋 Problema Identificado

**Erro**: Login de usuários existentes retorna erro 500  
**Causa Provável**: Tokens JWT antigos contêm referências a chaves Supabase antigas (URL ou Service Role Key foram alteradas)

## 🔍 Análise do Fluxo de Autenticação

### 1. **Fluxo de Login Atual**

```
Frontend (LoginPage.jsx)
    ↓
authStore.login(email, password)
    ↓
authService.login(email, password) → POST /auth/login
    ↓
Backend (authController.js)
    ↓
1. Busca usuário no Supabase: supabase.from('profiles').select('*').eq('email', email)
2. Valida senha: bcrypt.compare(senha, user.senha_hash)
3. Gera token JWT: jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' })
4. Retorna: { user, token }
    ↓
Frontend armazena no localStorage via Zustand persist
```

### 2. **Fluxo de Requisições Autenticadas**

```
Frontend (api.js interceptor)
    ↓
Adiciona header: Authorization: Bearer <token>
    ↓
Backend (authMiddleware.js)
    ↓
1. Extrai token do header
2. Verifica JWT: jwt.verify(token, JWT_SECRET)
3. Busca usuário: supabase.from('profiles').select('*').eq('id', decoded.userId)
4. Anexa req.user = user
```

## 🐛 Causa Raiz do Erro 500

### **Cenário Provável**:

1. **Chaves Supabase foram alteradas** (SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY)
2. **Tokens JWT antigos ainda estão válidos** (não expiraram - 7 dias)
3. **Usuários com tokens antigos fazem login**:
   - Token JWT é válido (assinado com JWT_SECRET correto)
   - Mas o `userId` no token pode não existir no novo Supabase
   - Ou a query `supabase.from('profiles')` falha porque a tabela não existe ainda

### **Evidências**:

- **CLAUDE.md linha 70**: "tabelas `profiles`, `properties`, `campaigns`, `subscriptions`, `password_resets` ainda não existem"
- **authMiddleware.js linha 15-19**: Query para `profiles` sem tratamento de erro adequado
- **authController.js linha 71-75**: Query para `profiles` pode falhar se tabela não existe

## ✅ Soluções Propostas

### **Solução 1: Forçar Logout de Todos os Usuários** (Recomendado)

**Objetivo**: Invalidar todos os tokens antigos e forçar novo login

**Implementação**:

1. **Alterar JWT_SECRET no Railway**
   - Gera nova secret: `openssl rand -base64 32`
   - Atualiza variável `JWT_SECRET` no Railway
   - Todos os tokens antigos se tornam inválidos instantaneamente

2. **Melhorar tratamento de erro no authMiddleware**
   - Retornar erro 401 claro quando token é inválido
   - Logar detalhes do erro para debug

3. **Frontend detecta 401 e faz logout automático**
   - Limpa localStorage
   - Redireciona para /login
   - Mostra mensagem: "Sua sessão expirou. Faça login novamente."

**Vantagens**:
- ✅ Solução imediata e definitiva
- ✅ Força todos a fazer novo login com credenciais corretas
- ✅ Garante que todos os tokens usam as chaves Supabase corretas

**Desvantagens**:
- ⚠️ Todos os usuários precisam fazer login novamente (aceitável se a base é pequena)

---

### **Solução 2: Migração Gradual** (Mais Complexa)

**Objetivo**: Manter tokens antigos funcionando enquanto migra usuários

**Implementação**:

1. **Adicionar campo `migrated` na tabela profiles**
2. **No authMiddleware, detectar se usuário precisa migração**
3. **Retornar erro 401 com código especial: `MIGRATION_REQUIRED`**
4. **Frontend detecta e força novo login**

**Vantagens**:
- ✅ Controle granular sobre migração

**Desvantagens**:
- ❌ Mais complexo
- ❌ Requer alteração no schema do banco
- ❌ Não resolve o problema imediatamente

---

## 🎯 Plano de Ação Recomendado

### **Fase 1: Verificar Estado Atual**

1. ✅ Confirmar que tabela `profiles` existe no Supabase
2. ✅ Verificar se `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` estão corretas no Railway
3. ✅ Testar query manual no Supabase: `SELECT * FROM profiles LIMIT 1`

### **Fase 2: Implementar Correções**

1. **Melhorar authMiddleware.js** (logging detalhado)
2. **Adicionar tratamento de erro no frontend** (logout automático em 401)
3. **Alterar JWT_SECRET no Railway** (invalidar tokens antigos)

### **Fase 3: Testar**

1. Fazer login com usuário existente
2. Verificar se token funciona em requisições autenticadas
3. Verificar logs no Railway se houver erro

---

## 📝 Arquivos a Modificar

### 1. **backend/src/middleware/auth.js**
- Adicionar logging detalhado de erros
- Melhorar mensagens de erro

### 2. **frontend/src/services/api.js**
- Adicionar interceptor de resposta para detectar 401
- Fazer logout automático e redirecionar para /login

### 3. **Railway Dashboard**
- Gerar novo JWT_SECRET
- Atualizar variável de ambiente

---

## 🔧 Código das Correções

### **1. Melhorar authMiddleware.js**

```javascript
async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Token de acesso necessário' })
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    const { data: user, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', decoded.userId)
      .single()

    if (error) {
      console.error('=== ERRO AUTH MIDDLEWARE ===')
      console.error('User ID:', decoded.userId)
      console.error('Supabase error:', error)
      return res.status(401).json({ success: false, message: 'Usuário não encontrado', code: 'USER_NOT_FOUND' })
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'Usuário não encontrado', code: 'USER_NOT_FOUND' })
    }

    req.user = user
    next()
  } catch (err) {
    console.error('=== ERRO JWT VERIFY ===')
    console.error('Error:', err.message)
    return res.status(401).json({ success: false, message: 'Token inválido ou expirado', code: 'INVALID_TOKEN' })
  }
}
```

### **2. Adicionar interceptor no frontend (api.js)**

```javascript
// Interceptor de resposta para logout automático em 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token inválido ou expirado - fazer logout
      const { logout } = useAuthStore.getState()
      logout()
      
      // Redirecionar para login se não estiver já lá
      if (window.location.pathname !== '/login') {
        window.location.href = '/login?expired=true'
      }
    }
    return Promise.reject(error)
  }
)
```

### **3. Gerar novo JWT_SECRET**

```bash
# No terminal local
openssl rand -base64 32

# Copiar output e atualizar no Railway Dashboard
# Variables → JWT_SECRET → Colar novo valor
```

---

## ⚠️ Considerações Importantes

1. **Backup antes de alterar JWT_SECRET**: Todos os usuários serão deslogados
2. **Comunicar aos usuários**: Se houver base ativa, avisar que precisarão fazer login novamente
3. **Verificar tabela profiles existe**: Sem ela, nenhum login funcionará
4. **Testar em ambiente local primeiro**: Antes de aplicar em produção

---

**Status**: 📋 Plano criado, aguardando aprovação para implementação
