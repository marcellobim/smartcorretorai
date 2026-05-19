// Script de teste para simular requisição POST /api/generate
// Carrega variáveis de ambiente manualmente
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'sua-chave-aqui'

const testPayload = {
  categoria: 'medio_padrao',
  tipo: 'Apartamento',
  finalidade: 'Venda',
  quartos: 3,
  banheiros: 2,
  vagas: 2,
  area: '85',
  preco: 450000,
  bairro: 'Jardins',
  cidade: 'São Paulo',
  estado: 'SP',
  diferenciais: ['Varanda gourmet', 'Piscina', 'Academia'],
  descricao: 'Apartamento moderno com acabamento de primeira',
  telefone_contato: '(11) 99999-9999',
  redes_sociais: ['instagram_feed', 'instagram_stories', 'whatsapp', 'facebook'],
  // fotos: [] // Sem fotos para simplificar o teste inicial
}

async function testarGeracao() {
  console.log('🧪 INICIANDO TESTE DE GERAÇÃO LOCAL')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  
  try {
    // Simula a chamada para o serviço OpenAI diretamente
    const { gerarTextosCampanha } = require('./backend/src/services/openai')
    
    console.log('📤 Enviando dados para OpenAI GPT-4o-mini...')
    console.log('Payload:', JSON.stringify(testPayload, null, 2))
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    const resultado = await gerarTextosCampanha(testPayload)
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('✅ RESPOSTA RECEBIDA DA OPENAI:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('Título da campanha:', resultado.titulo_campanha)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('Textos gerados:')
    console.log('  - Instagram Feed:', resultado.textos?.instagram_feed ? '✅' : '❌')
    console.log('  - Instagram Stories:', resultado.textos?.instagram_stories ? '✅' : '❌')
    console.log('  - Facebook:', resultado.textos?.facebook ? '✅' : '❌')
    console.log('  - WhatsApp:', resultado.textos?.whatsapp ? '✅' : '❌')
    console.log('  - TikTok:', resultado.textos?.tiktok ? '✅' : '❌')
    console.log('  - YouTube:', resultado.textos?.youtube ? '✅' : '❌')
    console.log('  - LinkedIn:', resultado.textos?.linkedin ? '✅' : '❌')
    console.log('  - Portais:', resultado.textos?.portais ? '✅' : '❌')
    console.log('  - Roteiro Locução:', resultado.textos?.roteiro_locucao ? '✅' : '❌')
    console.log('  - Catálogo PDF:', resultado.textos?.catalogo_pdf ? '✅' : '❌')
    console.log('  - Google Ads:', resultado.textos?.google_ads ? '✅' : '❌')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    // Mostra exemplo de um texto gerado
    if (resultado.textos?.instagram_feed) {
      console.log('📱 EXEMPLO - Instagram Feed:')
      console.log('Legenda:', resultado.textos.instagram_feed.legenda?.substring(0, 150) + '...')
      console.log('Hashtags:', resultado.textos.instagram_feed.hashtags?.substring(0, 100) + '...')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    }
    
    if (resultado.textos?.whatsapp) {
      console.log('💬 EXEMPLO - WhatsApp:')
      console.log(resultado.textos.whatsapp.mensagem?.substring(0, 200) + '...')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    }
    
    console.log('✅ TESTE CONCLUÍDO COM SUCESSO!')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
  } catch (erro) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('❌ ERRO NO TESTE:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.error('Tipo:', erro.name)
    console.error('Mensagem:', erro.message)
    console.error('Stack:', erro.stack)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    process.exit(1)
  }
}

testarGeracao()
