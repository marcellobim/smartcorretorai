/**
 * Script de teste para verificar se a API do Claude está funcionando
 * 
 * Como usar:
 * 1. Substitua 'SUA_CHAVE_AQUI' pela sua ANTHROPIC_API_KEY
 * 2. Execute: node test-claude-api.js
 */

const Anthropic = require('@anthropic-ai/sdk');

// SUBSTITUA AQUI pela sua chave da Anthropic
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'SUA_CHAVE_AQUI';

async function testarClaudeAPI() {
  console.log('🔍 Testando conexão com Claude API...\n');
  
  if (!ANTHROPIC_API_KEY || ANTHROPIC_API_KEY === 'SUA_CHAVE_AQUI') {
    console.error('❌ ERRO: ANTHROPIC_API_KEY não configurada!');
    console.log('\n📝 Configure a variável de ambiente ou edite o arquivo:');
    console.log('   export ANTHROPIC_API_KEY=sk-ant-...');
    console.log('   ou edite test-claude-api.js e substitua SUA_CHAVE_AQUI\n');
    process.exit(1);
  }

  try {
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    console.log('📡 Enviando requisição para Claude 3.5 Sonnet...');
    const startTime = Date.now();

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: 'Teste de conexão. Responda apenas: OK'
        }
      ]
    });

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('\n✅ SUCESSO! API do Claude está funcionando!\n');
    console.log('📊 Detalhes da resposta:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Modelo: ${response.model}`);
    console.log(`   Tempo de resposta: ${duration}s`);
    console.log(`   Tokens de entrada: ${response.usage.input_tokens}`);
    console.log(`   Tokens de saída: ${response.usage.output_tokens}`);
    console.log(`   ID da mensagem: ${response.id}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const textBlock = response.content.find(b => b.type === 'text');
    if (textBlock) {
      console.log('💬 Resposta do Claude:');
      console.log(`   "${textBlock.text}"\n`);
    }

    console.log('✨ Tudo funcionando perfeitamente!');
    console.log('   A geração de conteúdo está operacional.\n');

  } catch (error) {
    console.error('\n❌ ERRO ao conectar com Claude API:\n');
    
    if (error.status === 401) {
      console.error('🔑 Erro de autenticação (401)');
      console.error('   A ANTHROPIC_API_KEY está inválida ou expirada.');
      console.error('   Verifique sua chave em: https://console.anthropic.com/\n');
    } else if (error.status === 429) {
      console.error('⏱️  Limite de requisições excedido (429)');
      console.error('   Aguarde alguns minutos antes de tentar novamente.\n');
    } else if (error.status === 500 || error.status === 529) {
      console.error('🔧 Erro no servidor da Anthropic');
      console.error('   Tente novamente em alguns minutos.\n');
    } else {
      console.error('Detalhes do erro:');
      console.error(error.message);
      if (error.status) {
        console.error(`Status HTTP: ${error.status}`);
      }
      console.error('');
    }
    
    process.exit(1);
  }
}

// Executar teste
testarClaudeAPI();
