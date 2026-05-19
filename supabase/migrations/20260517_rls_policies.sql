-- Habilitar RLS nas tabelas
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Políticas para campaigns
CREATE POLICY "Usuário vê apenas suas campanhas"
ON public.campaigns FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Usuário cria apenas suas campanhas"
ON public.campaigns FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuário atualiza apenas suas campanhas"
ON public.campaigns FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Usuário deleta apenas suas campanhas"
ON public.campaigns FOR DELETE
USING (auth.uid() = user_id);

-- Políticas para properties
CREATE POLICY "Usuário vê apenas seus imóveis"
ON public.properties FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Usuário cria apenas seus imóveis"
ON public.properties FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuário atualiza apenas seus imóveis"
ON public.properties FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Usuário deleta apenas seus imóveis"
ON public.properties FOR DELETE
USING (auth.uid() = user_id);

-- Políticas para profiles
CREATE POLICY "Usuário vê apenas seu perfil"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Usuário atualiza apenas seu perfil"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

-- Políticas para subscriptions
CREATE POLICY "Usuário vê apenas sua assinatura"
ON public.subscriptions FOR SELECT
USING (auth.uid() = user_id);
