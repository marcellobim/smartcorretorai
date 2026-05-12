const Anthropic = require('@anthropic-ai/sdk')

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const CATEGORIA_CONFIG = {
  alto_padrao: {
    publico: 'compradores de alto poder aquisitivo que buscam exclusividade, status e lifestyle premium',
    tom: 'sofisticado, elegante e exclusivo — como o texto de uma revista de luxo, sem exageros',
    foco: 'lifestyle premium, acabamentos nobres, localização privilegiada, exclusividade, privacidade, segurança do investimento e valorização patrimonial',
    roteiro_video: 'cinematográfico e elegante: planos lentos e abertos, trilha orquestral suave, narração em voz grave e pausada, foco em detalhes de acabamento e ambientes espaçosos, luz natural e tons quentes. Cada cena: 4-6 segundos.',
    nota: 'Use palavras como: exclusivo, privilegiado, sofisticado, único, requintado. Evite promoções ou linguagem popular.',
  },
  medio_padrao: {
    publico: 'famílias e profissionais que buscam qualidade de vida, praticidade e bom custo-benefício',
    tom: 'profissional, acolhedor e direto — próximo, sem ser informal demais',
    foco: 'custo-benefício, localização conveniente, área de lazer, boa planta, segurança do condomínio, qualidade de vida cotidiana',
    roteiro_video: 'dinâmico e moderno: cortes rápidos mostrando cada ambiente, trilha animada e positiva, legendas com atributos principais, destacar área de lazer e localização',
    nota: 'Mostre como o imóvel facilita e melhora o dia a dia da família. Foque em praticidade e qualidade.',
  },
  popular_mcmv: {
    publico: 'famílias de baixa e média renda realizando o sonho da casa própria via FGTS e financiamento Caixa',
    tom: 'caloroso, próximo e motivador — como um amigo ajudando a realizar um sonho grande',
    foco: 'realização do sonho da casa própria, facilidade de financiamento, uso do FGTS, parcelas acessíveis, segurança e tranquilidade para a família',
    roteiro_video: 'emocionante e familiar: família feliz entrando na casa nova, crianças brincando, trilha alegre e emotiva, narração acolhedora focada na conquista e na felicidade',
    nota: 'Sempre mencione FGTS, Caixa Econômica e parcelas acessíveis quando aplicável. Linguagem simples e próxima.',
  },
  lancamento: {
    publico: 'investidores e compradores buscando novidade, valorização e condições especiais de pré-lançamento',
    tom: 'entusiasmado, urgente e exclusivo — crie senso de oportunidade única que não vai se repetir',
    foco: 'preço de lançamento menor que na entrega, valorização garantida, planta moderna, infraestrutura completa, condições especiais durante as obras',
    roteiro_video: 'impactante e moderno: reveal dramático do nome do empreendimento, renders 3D de alta qualidade, trilha eletrônica progressiva, senso de urgência e exclusividade',
    nota: 'Crie urgência: preços de lançamento são temporários. Use FOMO (medo de perder a oportunidade).',
  },
  em_construcao: {
    publico: 'compradores que querem economizar comprando em obra e têm tempo de esperar a entrega',
    tom: 'transparente, confiante e animador — mostre o progresso e construa expectativa positiva',
    foco: 'preço menor que na entrega, possibilidade de personalização, prazo de entrega claro, solidez da construtora',
    roteiro_video: 'progressivo e confiante: split-screen comparando a obra atual com o render finalizado, percentual de progresso da obra, data de entrega em destaque',
    nota: 'Compare preço atual vs. estimativa na entrega para mostrar a valorização já garantida ao comprador.',
  },
}

async function gerarTextosCampanha(dados) {
  const {
    descricao_livre, categoria, tipo, finalidade, quartos, banheiros, vagas, area,
    preco, bairro, cidade, estado, diferenciais, descricao, tom, publico_alvo,
    telefone_contato, redes_sociais, fotos,
  } = dados

  // Monta contexto do imóvel
  const contexto = descricao_livre
    ? descricao_livre
    : [
        tipo && `Tipo: ${tipo}`,
        finalidade && `Finalidade: ${finalidade}`,
        quartos != null && `Quartos: ${quartos}`,
        banheiros != null && banheiros > 0 && `Banheiros: ${banheiros}`,
        vagas != null && vagas > 0 && `Vagas de garagem: ${vagas}`,
        area && `Área: ${area} m²`,
        preco && `Preço: R$ ${Number(preco).toLocaleString('pt-BR')}`,
        (bairro || cidade) && `Localização: ${[bairro, cidade, estado].filter(Boolean).join(', ')}`,
        diferenciais?.length && `Diferenciais: ${Array.isArray(diferenciais) ? diferenciais.join(', ') : diferenciais}`,
        descricao && `Informações adicionais: ${descricao}`,
        tom && `Tom desejado: ${tom}`,
        publico_alvo && `Público-alvo: ${publico_alvo}`,
      ].filter(Boolean).join('\n')

  const redes = redes_sociais?.join(', ') || 'instagram_feed, instagram_stories, whatsapp, facebook'
  const cfg = categoria ? CATEGORIA_CONFIG[categoria] : null

  const secaoCategoria = cfg ? `
CATEGORIA DO IMÓVEL: ${categoria.replace(/_/g, ' ').toUpperCase()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Público-alvo: ${cfg.publico}
• Tom de voz: ${cfg.tom}
• O que enfatizar: ${cfg.foco}
• Estilo do roteiro de vídeo: ${cfg.roteiro_video}
• Instrução especial: ${cfg.nota}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
` : ''

  const instrucaoLocalizacao = (bairro || cidade) ? `
PESQUISE A LOCALIZAÇÃO:
Com base no bairro "${bairro || ''}" na cidade "${cidade || ''}", incorpore naturalmente nos textos:
- As características e perfil do bairro (se conhecido)
- Pontos de referência próximos relevantes (shoppings, parques, metrô, universidades, praias, etc.)
- O estilo de vida que essa localização proporciona
Se não conhecer o bairro específico, descreva as vantagens da região de forma genérica e positiva.
` : ''

  const instrucaoFotos = fotos?.length ? `
ANÁLISE DAS FOTOS:
Foram enviadas ${fotos.length} foto(s) do imóvel. Analise os ambientes visíveis (sala, cozinha, quartos, área de lazer, etc.) e use essa análise para enriquecer as descrições. Mencione detalhes visuais específicos que valorizam o imóvel.
` : ''

  const prompt = `Você é um especialista em marketing imobiliário brasileiro. Gere textos de marketing altamente persuasivos e personalizados para o imóvel abaixo.
${secaoCategoria}${instrucaoLocalizacao}${instrucaoFotos}
INFORMAÇÕES DO IMÓVEL:
${contexto}
${telefone_contato ? `\nContato do corretor: ${telefone_contato}` : ''}

REDES SOCIAIS PARA GERAR: ${redes}

Retorne SOMENTE um JSON válido com esta estrutura exata:
{
  "titulo_campanha": "título curto e descritivo para identificação interna",
  "textos": {
    "instagram_feed": {
      "legenda": "legenda completa com gancho inicial forte, detalhes do imóvel e chamada para ação (mínimo 3 parágrafos)",
      "hashtags": "#hashtag1 #hashtag2 ... (10 a 15 hashtags altamente relevantes)",
      "cta": "chamada para ação curta e direta"
    },
    "instagram_stories": {
      "texto_principal": "texto impactante para stories (máx 3 linhas, linguagem dinâmica)",
      "cta": "chamada para ação (ex: Arraste para cima, Chame no direct)"
    },
    "facebook": {
      "texto": "texto completo para Facebook com todos os detalhes do imóvel (2 a 3 parágrafos)",
      "cta": "chamada para ação"
    },
    "whatsapp": {
      "mensagem": "mensagem completa pronta para enviar no WhatsApp, tom conversacional, com todos os detalhes e como entrar em contato"
    },
    "tiktok": {
      "roteiro": "roteiro DETALHADO cena por cena para vídeo de 30-60s. Formato: 'Cena 1: [o que filmar] — Narração: [exatamente o que falar]\\nCena 2: [o que filmar] — Narração: [o que falar]\\n...' (mínimo 5 cenas)",
      "hashtags": "#hashtag1 #hashtag2 ... (hashtags de tendência do TikTok Imóveis)"
    },
    "youtube": {
      "titulo_video": "título chamativo com palavra-chave de SEO",
      "descricao": "descrição completa do vídeo para YouTube (com todos os detalhes, localização, contato e hashtags)"
    },
    "linkedin": {
      "texto": "texto profissional para LinkedIn focado no investimento e oportunidade de negócio"
    },
    "portais": {
      "zap_imoveis": {
        "titulo": "título do anúncio (máx 60 chars, palavras-chave SEO imobiliário)",
        "descricao": "descrição completa e persuasiva para ZAP (300-500 palavras), detalhando ambientes, localização, diferenciais e condições",
        "destaques": ["destaque 1", "destaque 2", "destaque 3", "destaque 4", "destaque 5"]
      },
      "olx": {
        "titulo": "título para OLX (máx 60 chars, objetivo e direto)",
        "descricao": "texto completo para OLX (200-400 palavras), linguagem acessível, destacando preço e facilidades de pagamento",
        "destaques": ["destaque 1", "destaque 2", "destaque 3"]
      },
      "vivareal": {
        "titulo": "título para Viva Real (máx 60 chars, foco em benefícios)",
        "descricao": "descrição para Viva Real (300-500 palavras), foco em qualidade de vida e localização",
        "destaques": ["destaque 1", "destaque 2", "destaque 3", "destaque 4"]
      },
      "imovelweb": {
        "titulo": "título para ImovelWeb (máx 60 chars)",
        "descricao": "texto para ImovelWeb (200-400 palavras), com dados técnicos e diferenciais",
        "destaques": ["destaque 1", "destaque 2", "destaque 3"]
      }
    },
    "roteiro_locucao": "Script profissional completo para narração em vídeo de 45-60 segundos. Use pausas marcadas com [pausa], ênfases com MAIÚSCULAS e respirações com [respira]. Inclua abertura impactante, descrição do imóvel, bairro, preço e chamada para ação. Linguagem fluida e natural para locutor profissional.",
    "catalogo_pdf": {
      "titulo": "título principal do catálogo (ex: Apartamento Exclusivo no Itaim Bibi)",
      "subtitulo": "subtítulo com característica principal (ex: 3 suítes · 120m² · R$ 1.200.000)",
      "descricao_principal": "parágrafo principal de apresentação do imóvel (150-200 palavras), elegante e completo",
      "sobre_o_imovel": "descrição técnica: ambientes, acabamentos, planta, diferenciais construtivos (100-150 palavras)",
      "sobre_o_bairro": "descrição do bairro: localização, comércios próximos, qualidade de vida, valorização (100-150 palavras)",
      "pontos_fortes": ["ponto forte 1", "ponto forte 2", "ponto forte 3", "ponto forte 4", "ponto forte 5", "ponto forte 6"],
      "cta": "chamada para ação para o catálogo (ex: Agende uma visita: (11) 99999-9999)"
    },
    "google_ads": {
      "publico_descricao": "descrição do público-alvo ideal em 1 parágrafo",
      "faixa_etaria": "ex: 28-55 anos",
      "renda_estimada": "ex: Acima de R$ 8.000/mês",
      "interesses": ["interesse 1", "interesse 2", "interesse 3", "interesse 4", "interesse 5"],
      "palavras_chave": ["kw 1", "kw 2", "kw 3", "kw 4", "kw 5", "kw 6", "kw 7", "kw 8"],
      "raio_km": 15,
      "headline1": "headline Google Ads (máx 30 chars)",
      "headline2": "headline 2 (máx 30 chars)",
      "headline3": "headline 3 (máx 30 chars)",
      "descricao1": "descrição anúncio Google (máx 90 chars)",
      "descricao2": "descrição anúncio 2 (máx 90 chars)"
    }
  }
}

Adapte todo o tom, vocabulário e argumentos de venda ao perfil da categoria. Os textos devem parecer escritos por um corretor experiente que conhece profundamente o público deste tipo de imóvel.`

  // Monta array de conteúdo com fotos (vision) se disponíveis
  const userContent = []
  if (fotos && fotos.length > 0) {
    fotos.slice(0, 4).forEach(foto => {
      userContent.push({
        type: 'image',
        source: { type: 'base64', media_type: foto.tipo || 'image/jpeg', data: foto.dados },
      })
    })
  }
  userContent.push({ type: 'text', text: prompt })

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 6000,
    thinking: { type: 'adaptive' },
    messages: [{ role: 'user', content: userContent }],
  })

  const textBlock = response.content.find(b => b.type === 'text')
  const raw = textBlock ? textBlock.text.trim() : ''
  const jsonStr = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  return JSON.parse(jsonStr)
}

module.exports = { gerarTextosCampanha }
