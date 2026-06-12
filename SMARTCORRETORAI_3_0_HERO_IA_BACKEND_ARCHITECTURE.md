# SMARTCORRETORAI 3.0 - HERO IA BACKEND ARCHITECTURE

## Objetivo

Definir a arquitetura técnica definitiva do Hero IA antes da implementação do backend real.

O Hero IA é o primeiro produto premium visual da plataforma SmartCorretorAI 3.0. Ele deve gerar uma imagem principal de impacto para divulgação imobiliária, acompanhada por textos auxiliares de marketing, sem expor fornecedores, prompts técnicos, chaves, custos internos ou complexidade operacional ao corretor.

O Hero IA não funciona por prompt livre. O produto utiliza um Smart Prompt Engine guiado por perguntas, reaproveitando o Cadastro Mestre do imóvel, o Perfil Comercial e a Marca.

## Princípios

- O corretor escolhe objetivos e contexto, não escreve prompt técnico.
- O sistema monta o prompt final automaticamente.
- O Cadastro Mestre é a fonte principal de dados do imóvel.
- Toda geração acontece server-side.
- O frontend nunca acessa chaves, fornecedores ou custos internos.
- Toda operação deve validar ownership.
- Smart Tokens devem estar preparados para cobrança server-side, sem o frontend decidir custo, saldo ou consumo.
- A entrega deve ser clara, baixável e orientada ao próximo passo comercial.

## Fluxo Completo

### 1. Seleção do Imóvel

O usuário inicia o Hero IA a partir da página protegida `/hero`.

O sistema deve permitir selecionar um imóvel já cadastrado no Cadastro Mestre.

Se não houver imóvel:

- mostrar estado vazio;
- orientar o usuário a criar o Cadastro Mestre;
- não permitir geração.

Se o imóvel existir, o sistema carrega:

- tipo do imóvel;
- finalidade atual do MVP, quando aplicável;
- bairro;
- cidade;
- área;
- dormitórios;
- suítes;
- vagas;
- preço, se existir;
- destaques;
- fotos;
- vídeo opcional, se existir;
- dados estruturados em `master_property_v1`.

### 2. Escolha da Imagem

O usuário escolhe como o Hero IA deve usar imagens.

Opções:

- Usar foto principal.
- Usar fotos como referência.
- Criar imagem nova com IA.

Comportamento esperado:

- `Usar foto principal`: o prompt deve preservar o imóvel e melhorar contexto visual, composição e atmosfera.
- `Usar fotos como referência`: o prompt pode considerar múltiplas fotos para entender estilo, padrão e diferenciais.
- `Criar imagem nova com IA`: o prompt deve gerar uma imagem publicitária inspirada nos dados do imóvel, sem fingir que é fotografia real do imóvel se não houver referência visual suficiente.

Regra de segurança:

- o sistema não deve prometer fidelidade arquitetônica quando estiver criando imagem nova sem referência suficiente.

### 3. Público-Alvo

O usuário escolhe o público da comunicação.

Opções iniciais:

- Primeiro imóvel
- Família
- Investidor
- Executivo
- Alto padrão
- Lançamento
- Pré-lançamento
- Terreno
- Comercial

O público-alvo influencia:

- linguagem visual;
- atmosfera;
- enquadramento;
- argumentos;
- CTA;
- textos auxiliares;
- sugestões de direções criativas.

### 4. Subcategoria

Após selecionar o público, o sistema apresenta subcategorias compatíveis.

Exemplos:

Primeiro imóvel:

- FGTS
- Subsídio
- Entrada facilitada

Investidor:

- Valorização
- Rentabilidade
- Escassez

Executivo:

- Conveniência
- Exclusividade
- Localização

As subcategorias devem ser apresentadas apenas quando fizerem sentido para o público selecionado.

O sistema não deve inventar benefícios não informados. Por exemplo:

- não citar FGTS se a comunicação não selecionou ou informou esse contexto;
- não citar valorização garantida;
- não citar subsídio se não houver base para isso;
- não citar metrô, escola, shopping, segurança ou financiamento sem informação fornecida.

### 5. Destaques

O sistema carrega os destaques selecionados no Cadastro Mestre.

Regras:

- mostrar os destaques disponíveis;
- permitir usar todos ou selecionar os mais relevantes para a peça;
- preservar os dados originais do Cadastro Mestre;
- evitar poluir o prompt com excesso de diferenciais;
- priorizar diferenciais compatíveis com público e subcategoria.

Exemplo:

- Para investidor, priorizar localização, potencial de valorização, escassez, liquidez, se informados.
- Para família, priorizar planta, lazer, segurança, escolas ou conveniência apenas se informados.
- Para alto padrão, priorizar exclusividade, acabamento, vista, localização nobre e privacidade apenas se informados.

### 6. Campo Opcional

Campo:

`Deseja acrescentar algo?`

Finalidade:

- permitir uma orientação humana curta;
- adicionar nuance criativa;
- indicar tom visual desejado;
- informar restrições.

Regras:

- o campo é opcional;
- deve ter limite de tamanho;
- deve ser tratado como orientação, não como prompt absoluto;
- não pode sobrescrever regras de segurança, ownership, política de conteúdo ou dados estruturados confiáveis.

### 7. Checklist Final

Antes da geração, o sistema mostra uma revisão objetiva.

Itens exibidos:

- imóvel escolhido;
- imagem escolhida;
- público-alvo;
- subcategoria;
- destaques usados;
- orientação opcional;
- pacote de entrega marcado;
- política de retenção;
- confirmação de que a geração usará Smart Tokens, quando a cobrança estiver ativa.

O botão final deve ser:

`Gerar Hero IA`

### 8. Geração

Ao confirmar, o backend gera:

- 1 Hero Principal.

O sistema também retorna 3 Direções Criativas como sugestões textuais.

Exemplos:

- Lifestyle
- Investidor
- Exclusividade

As 3 direções não geram imagens automaticamente.

Cada direção deve aparecer com botão:

`Gerar esta versão`

Ao clicar, uma nova geração é iniciada server-side usando a direção escolhida como variação controlada.

## Pacote de Entrega

Por padrão, o Hero IA entrega:

- Hero IA
- Texto Instagram
- Hashtags
- CTA
- Texto WhatsApp
- Descrição Portal

O usuário pode desmarcar itens antes da geração.

Regras:

- se o usuário desmarcar um item textual, o backend não precisa gerar aquele texto;
- o Hero IA visual é o item principal;
- textos auxiliares são derivados do mesmo briefing;
- hashtags devem ser coerentes, sem acentos preferencialmente, sem termos estranhos e sem promessas não informadas;
- WhatsApp deve ser mensagem do corretor para o lead, nunca como se o lead estivesse perguntando.

## Pós-Geração

Ao concluir, a tela deve mostrar:

`Faça o download agora.`

Também deve lembrar a política de retenção:

- materiais disponíveis por 7 dias para download;
- após esse período, a retenção pode expirar conforme regra da plataforma.

Depois da entrega, perguntar:

`O que deseja fazer agora?`

Opções:

- Criar Campanha IA
- Criar Landing IA
- Gerar outra versão
- Tenho outro imóvel
- Voltar para Home

## Telas

### Tela 1 - Seleção do Imóvel

Componentes:

- título do fluxo;
- lista de imóveis recentes;
- busca ou seleção de imóvel;
- estado vazio;
- CTA para Cadastro Mestre.

Critérios:

- não permitir avançar sem imóvel;
- mostrar dados suficientes para reconhecer o imóvel;
- não expor IDs técnicos.

### Tela 2 - Configuração Visual

Componentes:

- escolha da imagem;
- fotos disponíveis;
- opção de criar imagem nova;
- aviso de fidelidade visual quando aplicável.

Critérios:

- distinguir foto real, referência e criação nova;
- não prometer resultado fotográfico fiel sem referência;
- não enviar imagem sem ownership validado.

### Tela 3 - Público e Subcategoria

Componentes:

- chips de público-alvo;
- subcategorias condicionais;
- explicação curta de cada escolha.

Critérios:

- linguagem simples;
- nenhum termo técnico;
- nenhum fornecedor visível.

### Tela 4 - Destaques e Orientação

Componentes:

- destaques vindos do Cadastro Mestre;
- seleção opcional de destaques prioritários;
- campo `Deseja acrescentar algo?`.

Critérios:

- preservar os dados do cadastro;
- não inventar informações;
- limitar orientação livre.

### Tela 5 - Checklist Final

Componentes:

- resumo do briefing;
- pacote de entrega;
- retenção;
- botão `Gerar Hero IA`.

Critérios:

- deixar claro o que será usado;
- permitir voltar e ajustar;
- preparar cobrança server-side por Smart Tokens.

### Tela 6 - Resultado

Componentes:

- preview do Hero IA;
- botões de download;
- textos auxiliares;
- 3 direções criativas;
- próximos passos.

Critérios:

- nunca mostrar tela branca;
- se a imagem falhar e textos gerarem, mostrar resultado parcial;
- se textos falharem e imagem gerar, mostrar imagem e erro textual discreto;
- se tudo falhar, mostrar erro amigável e opção de tentar novamente.

## Dados Necessários

### Imóvel

Fonte: Cadastro Mestre.

Campos principais:

- `property_id`
- `owner_id`
- `master_property_v1`
- tipo do imóvel
- bairro
- cidade
- preço
- área
- dormitórios
- suítes
- vagas
- destaques
- fotos
- vídeo opcional

### Perfil Comercial

Campos:

- nome profissional;
- imobiliária;
- CRECI, se informado;
- WhatsApp comercial;
- e-mail comercial;
- foto profissional.

Regra:

- não inventar CRECI;
- não usar placeholders fictícios;
- se incompleto, gerar com fallback seguro ou avisar o usuário.

### Marca

Campos:

- nome da marca;
- logo;
- cor principal;
- cor secundária;
- estilo visual.

Regra:

- usar quando disponível;
- não bloquear Hero IA se marca estiver incompleta;
- avisar discretamente quando o perfil comercial/marca puder melhorar o resultado.

### Seleções do Fluxo

Campos:

- modo de imagem;
- público-alvo;
- subcategoria;
- destaques priorizados;
- orientação opcional;
- pacote de entrega selecionado;
- direção criativa, quando for variação.

## Smart Prompt Engine

### Responsabilidade

O Smart Prompt Engine transforma dados estruturados e escolhas guiadas em prompts seguros, consistentes e comerciais.

Ele deve montar:

- briefing visual;
- prompt de imagem;
- prompt negativo/restrições;
- instruções de texto;
- direções criativas;
- metadados da geração.

### Entrada

Exemplo conceitual:

```json
{
  "property": {
    "type": "Apartamento",
    "city": "São Paulo",
    "neighborhood": "Lapa",
    "features": ["Varanda gourmet", "Piscina", "Academia"],
    "bedrooms": 2,
    "suites": 1,
    "parking": 1,
    "area": "120m²"
  },
  "visual_mode": "use_main_photo",
  "audience": "Família",
  "subcategory": "Conveniência",
  "extra_instruction": "Valorizar a varanda e a sensação de amplitude.",
  "deliverables": {
    "hero_image": true,
    "instagram_text": true,
    "hashtags": true,
    "cta": true,
    "whatsapp_text": true,
    "portal_description": true
  }
}
```

### Saída

Exemplo conceitual:

```json
{
  "image_prompt": "Imagem publicitária premium para divulgação imobiliária...",
  "negative_prompt": "Não incluir texto ilegível, marcas falsas, pessoas deformadas...",
  "text_brief": "Apartamento para família na Lapa...",
  "creative_directions": [
    {
      "id": "lifestyle",
      "title": "Lifestyle",
      "description": "Valoriza rotina, conforto e desejo de morar."
    },
    {
      "id": "familia",
      "title": "Família",
      "description": "Enfatiza espaço, segurança e conveniência."
    },
    {
      "id": "exclusividade",
      "title": "Exclusividade",
      "description": "Foca em apresentação mais sofisticada."
    }
  ]
}
```

### Camadas do Engine

1. Normalização de dados.
2. Validação de dados confiáveis.
3. Seleção de argumentos permitidos.
4. Seleção de tom visual.
5. Montagem do prompt de imagem.
6. Montagem dos textos auxiliares.
7. Geração de direções criativas.
8. Filtros contra invenção de informação.
9. Metadados e auditoria.

### Regras de Conteúdo

- Não inventar metrô, shopping, escola, segurança, vista, financiamento, subsídio, rentabilidade ou valorização.
- Não prometer retorno financeiro.
- Não usar nomes de fornecedores.
- Não usar linguagem técnica.
- Não criar CRECI falso.
- Não expor dados privados.
- Não gerar texto como se fosse o lead falando.
- CTA deve ser curto e comercial.

## Backend Proposto

### Edge Function Principal

Nome sugerido:

`gerar-hero-ia`

Responsabilidades:

- validar autenticação;
- derivar usuário do JWT;
- validar ownership do imóvel;
- carregar dados do Cadastro Mestre;
- carregar Perfil Comercial e Marca;
- validar pacote de entrega;
- calcular custo server-side de Smart Tokens;
- reservar Smart Tokens, quando a cobrança estiver ativa;
- montar briefing com Smart Prompt Engine;
- chamar serviços internos de geração;
- salvar metadados e resultado;
- retornar resposta estruturada.

### Edge Function de Status

Nome sugerido:

`get-hero-status`

Responsabilidades:

- consultar status da geração;
- validar ownership;
- finalizar consumo/cancelamento de Smart Tokens;
- retornar resultado parcial ou completo;
- ser idempotente.

### RPCs / Operações

Usar ou adaptar padrões já existentes:

- reserva server-side;
- consumo idempotente;
- cancelamento em falha;
- auditoria de geração.

Não criar novo sistema financeiro sem necessidade.

## Estrutura de Resposta

Resposta inicial:

```json
{
  "success": true,
  "generation_id": "hero_...",
  "status": "processing",
  "requested_deliverables": ["hero_image", "instagram_text", "hashtags", "cta", "whatsapp_text", "portal_description"],
  "creative_directions": [
    { "id": "lifestyle", "title": "Lifestyle" },
    { "id": "investidor", "title": "Investidor" },
    { "id": "exclusividade", "title": "Exclusividade" }
  ]
}
```

Resposta final:

```json
{
  "success": true,
  "generation_id": "hero_...",
  "status": "completed",
  "hero_image": {
    "url": "signed-url-or-public-delivery-url",
    "expires_at": "..."
  },
  "texts": {
    "instagram": "...",
    "hashtags": "...",
    "cta": "...",
    "whatsapp": "...",
    "portal_description": "..."
  },
  "retention": {
    "days": 7,
    "message": "Faça o download agora. Seus materiais ficam disponíveis por 7 dias."
  }
}
```

## Segurança

### Autenticação

- Exigir JWT válido.
- Não aceitar `user_id` vindo do frontend como fonte de verdade.
- Derivar usuário da sessão validada.

### Autorização

- Todo imóvel deve possuir owner.
- Toda geração deve possuir owner.
- Todo arquivo deve possuir owner.
- Leitura, download, status e exclusão devem validar ownership.

### Secrets

- Nenhuma chave no frontend.
- Nenhum fornecedor exposto no frontend.
- Nenhuma key em logs.
- Variáveis sensíveis apenas no backend.

### Storage

- Preferir bucket privado.
- Usar signed URLs quando necessário.
- Não expor URLs permanentes se o material tiver retenção de 7 dias.
- Não reutilizar fotos de clientes em previews ou exemplos públicos.

### Logs

Registrar:

- geração iniciada;
- geração concluída;
- geração falha;
- tentativa sem ownership;
- erro de validação;
- consumo/cancelamento de Smart Tokens.

Não registrar:

- prompt completo com dados pessoais;
- URLs privadas completas;
- telefone/e-mail em logs;
- secrets;
- payloads extensos.

## Smart Tokens

O Hero IA deve estar preparado para Smart Tokens, mas o frontend não decide:

- saldo;
- custo;
- consumo;
- devolução;
- regra de cobrança.

Fluxo esperado:

1. Backend calcula custo.
2. Backend reserva capacidade.
3. Geração inicia.
4. Sucesso consome.
5. Falha cancela/devolve.
6. Operação é idempotente.

Se a cobrança ainda não estiver ativa no MVP, manter campos e estrutura preparados, sem simular consumo falso.

## Dependências

- Cadastro Mestre do Imóvel.
- Perfil Comercial.
- Marca.
- Storage de fotos.
- Edge Functions.
- Sistema de Smart Tokens.
- Sistema de retenção de arquivos.
- UI protegida `/hero`.
- Home Inteligente para retorno pós-geração.

## Riscos

### Qualidade Visual

Risco:

- imagem gerada não representar bem o imóvel.

Mitigação:

- diferenciar claramente foto real, referência e criação nova;
- usar fotos do Cadastro Mestre como referência quando possível;
- permitir gerar variação.

### Invenção de Informação

Risco:

- IA citar benefícios não informados.

Mitigação:

- Smart Prompt Engine com regras negativas;
- lista de argumentos permitidos;
- pós-validação de textos.

### Abuso de Geração

Risco:

- usuário automatizar geração ou gastar indevidamente.

Mitigação:

- rate limit por usuário/IP;
- limite de geração simultânea;
- Smart Tokens server-side;
- idempotência.

### Vazamento de Dados

Risco:

- URLs, fotos, telefone, e-mail ou prompts sensíveis em logs.

Mitigação:

- logs mínimos;
- signed URLs;
- ownership;
- sanitização.

### Falha Parcial

Risco:

- imagem gera, textos falham, ou o inverso.

Mitigação:

- resultado parcial visível;
- status claro;
- retry controlado por entrega.

## Preparação para Implementação

### Fase 1 - Contrato Técnico

- Definir payload da Edge Function `gerar-hero-ia`.
- Definir response padrão.
- Definir status possíveis.
- Definir custo server-side planejado.
- Definir armazenamento do resultado.

### Fase 2 - Smart Prompt Engine

- Criar normalizador de Cadastro Mestre.
- Criar mapeamento público-alvo/subcategoria.
- Criar regras anti-invenção.
- Criar gerador de direções criativas.

### Fase 3 - Backend MVP

- Criar Edge Function server-side.
- Validar auth e ownership.
- Gerar briefing.
- Retornar placeholder controlado ou geração real, conforme liberação.
- Preparar logs e erros seguros.

### Fase 4 - Geração Real

- Integrar provedor server-side sem expor fornecedor.
- Salvar resultado.
- Retornar URL segura.
- Implementar retry e falha parcial.

### Fase 5 - Smart Tokens

- Ativar reserva.
- Ativar consumo.
- Ativar cancelamento por falha.
- Validar idempotência.

### Fase 6 - Pós-Geração

- Download.
- Variações.
- Encaminhamento para Campanha IA.
- Encaminhamento para Landing IA.
- Retenção de 7 dias.

## Critérios de Aceite para Implementação

- Usuário consegue selecionar imóvel do Cadastro Mestre.
- Usuário consegue escolher modo de imagem.
- Usuário consegue escolher público e subcategoria.
- Usuário vê checklist antes de gerar.
- Backend valida JWT e ownership.
- Nenhuma key aparece no frontend.
- Nenhum fornecedor aparece na UI.
- Hero Principal é gerado ou retorna erro amigável.
- 3 direções criativas aparecem como sugestões, sem gerar imagens automaticamente.
- Pacote textual respeita itens marcados/desmarcados.
- Pós-geração exibe download e retenção.
- Falha parcial não gera tela branca.
- Smart Tokens ficam preparados server-side.

## Fora do Escopo Desta Arquitetura

- Implementação de código.
- Alteração de banco.
- Alteração de Stripe.
- Alteração do Produto 3.
- Alteração da Landing Pública.
- Alteração da Home Inteligente.
- Deploy.
- Commit.
