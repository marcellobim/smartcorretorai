/**
 * Script para verificar e executar migrations no Supabase
 * 
 * Uso:
 * 1. Configure as variáveis SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
 * 2. Execute: node check-and-migrate-supabase.js
 */

const fs = require('fs');
const path = require('path');

// ============================================
// CONFIGURAÇÃO - Preencha com suas credenciais
// ============================================
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://seu-projeto.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sua-service-role-key';

// ============================================
// Função para executar query no Supabase
// ============================================
async function executeQuery(sql) {
  const url = `${SUPABASE_URL}/rest/v1/rpc/exec_sql`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ query: sql })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    return await response.json();
  } catch (error) {
    console.error('❌ Erro ao executar query:', error.message);
    throw error;
  }
}

// ============================================
// Verificar se uma tabela existe
// ============================================
async function tableExists(tableName) {
  const sql = `
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = '${tableName}'
    );
  `;
  
  try {
    const result = await executeQuery(sql);
    return result && result.length > 0 && result[0].exists;
  } catch (error) {
    console.error(`❌ Erro ao verificar tabela ${tableName}:`, error.message);
    return false;
  }
}

// ============================================
// Executar migration
// ============================================
async function executeMigration(migrationFile) {
  const migrationPath = path.join(__dirname, 'supabase', 'migrations', migrationFile);
  
  if (!fs.existsSync(migrationPath)) {
    console.error(`❌ Arquivo de migration não encontrado: ${migrationFile}`);
    return false;
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');
  
  console.log(`\n📝 Executando migration: ${migrationFile}`);
  console.log('─'.repeat(60));
  
  try {
    // Dividir o SQL em statements individuais (separados por ponto e vírgula)
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const statement of statements) {
      if (statement) {
        await executeQuery(statement + ';');
      }
    }
    
    console.log(`✅ Migration ${migrationFile} executada com sucesso!`);
    return true;
  } catch (error) {
    console.error(`❌ Erro ao executar migration ${migrationFile}:`, error.message);
    return false;
  }
}

// ============================================
// Verificar tabelas e executar migrations
// ============================================
async function checkAndMigrate() {
  console.log('\n🔍 VERIFICAÇÃO DE TABELAS DO SUPABASE');
  console.log('='.repeat(60));
  console.log(`📍 URL: ${SUPABASE_URL}`);
  console.log('='.repeat(60));

  const tables = ['profiles', 'properties', 'campaigns', 'subscriptions', 'password_resets', 'social_connections'];
  const missingTables = [];

  console.log('\n📊 Verificando tabelas...\n');

  for (const table of tables) {
    const exists = await tableExists(table);
    if (exists) {
      console.log(`✅ ${table.padEnd(20)} - Existe`);
    } else {
      console.log(`❌ ${table.padEnd(20)} - NÃO EXISTE`);
      missingTables.push(table);
    }
  }

  if (missingTables.length === 0) {
    console.log('\n✅ Todas as tabelas existem! Nenhuma migration necessária.');
    return;
  }

  console.log('\n⚠️  Tabelas faltando:', missingTables.join(', '));
  console.log('\n🔧 Executando migrations...');
  console.log('='.repeat(60));

  const migrations = [
    '001_initial_schema.sql',
    '002_social_connections.sql',
    '003_plans_update.sql',
    '004_add_role_column.sql'
  ];

  let successCount = 0;
  let failCount = 0;

  for (const migration of migrations) {
    const success = await executeMigration(migration);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMO DA EXECUÇÃO');
  console.log('='.repeat(60));
  console.log(`✅ Migrations executadas com sucesso: ${successCount}`);
  console.log(`❌ Migrations com erro: ${failCount}`);
  
  if (failCount === 0) {
    console.log('\n🎉 Todas as migrations foram executadas com sucesso!');
  } else {
    console.log('\n⚠️  Algumas migrations falharam. Verifique os erros acima.');
  }
}

// ============================================
// Executar script
// ============================================
if (SUPABASE_URL === 'https://seu-projeto.supabase.co' || SUPABASE_SERVICE_ROLE_KEY === 'sua-service-role-key') {
  console.error('\n❌ ERRO: Configure as variáveis SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY');
  console.error('\nOpções:');
  console.error('1. Edite o arquivo e preencha as constantes no topo');
  console.error('2. Ou execute com variáveis de ambiente:');
  console.error('   SUPABASE_URL=https://... SUPABASE_SERVICE_ROLE_KEY=... node check-and-migrate-supabase.js\n');
  process.exit(1);
}

checkAndMigrate().catch(error => {
  console.error('\n❌ Erro fatal:', error);
  process.exit(1);
});
