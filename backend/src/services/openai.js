const OpenAI = require('openai')

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

async function gerarTextosCampanha({ titulo, tipo, finalidade, preco, area, quartos, banheiros, vagas, bairro, cidade, estado, descricao, tom, publico_alvo, telefone_contato, redes_sociais }) {
  const prompt = `Você é um especialista em marketing imobiliário brasileiro. Gere textos de alta conversão para as redes sociais indicadas.

DADOS DO IMÓVEL:
- Título: ${titulo}
- Tipo: ${tipo}
- Finalidade: ${finalidade}
- Preço: R$ ${Number(preco).toLocaleString('pt-BR')}
- Área: ${area || 'Não informada'} m²
- Quartos: ${quartos || 0} | Banheiros: ${banheiros || 0} | Vagas: ${vagas || 0}
- Localização: ${bairro}, ${cidade} - ${estado}
- Descrição: ${descricao}
- Tom desejado: ${tom || 'profissional'}
- Público-alvo: ${publico_alvo || 'geral'}
- Contato: ${telefone_contato || 'Não informado'}

REDES SOCIAIS PARA GERAR: ${redes_sociais.join(', ')}

Retorne SOMENTE um JSON válido com a seguinte estrutura:
{
  "titulo_campanha": "título resumido para identificação interna",
  "textos": {
    "instagram_feed": { "legenda": "...", "hashtags": "...", "cta": "..." },
    "instagram_stories": { "texto_principal": "...", "cta": "..." },
    "facebook": { "texto": "...", "cta": "..." },
    "whatsapp": { "mensagem": "..." },
    "tiktok": { "roteiro": "...", "hashtags": "..." },
    "youtube": { "titulo_video": "...", "descricao": "..." },
    "linkedin": { "texto": "..." }
  },
  "prompt_imagem": "Descrição detalhada em inglês para gerar uma imagem de marketing imobiliário profissional para este imóvel, sem texto sobreposto"
}

Gere apenas os textos para as redes solicitadas. Os textos devem ser em português brasileiro, naturais e altamente persuasivos.`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.8,
    max_tokens: 2000,
  })

  return JSON.parse(response.choices[0].message.content)
}

async function gerarImagemBanner(promptImagem, tamanho = '1024x1024') {
  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt: `Professional real estate marketing banner. ${promptImagem}. Clean, modern design, high quality photography style, luxury feel, no text overlay, suitable for social media.`,
    n: 1,
    size: tamanho,
    quality: 'standard',
    style: 'natural',
  })

  return response.data[0].url
}

module.exports = { gerarTextosCampanha, gerarImagemBanner }
