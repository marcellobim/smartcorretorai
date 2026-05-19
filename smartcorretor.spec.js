const { test, expect } = require('@playwright/test');

test.describe('SmartCorretor AI - Smoke Test (Trava de Segurança)', () => {
  
  test('Deve carregar a página de login sem erros 500/502', async ({ page }) => {
    // Captura erros de console
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Captura erros de resposta HTTP
    const httpErrors = [];
    page.on('response', response => {
      if (response.status() >= 500) {
        httpErrors.push(`${response.status()} - ${response.url()}`);
      }
    });

    // Acessa a página de login em produção (rota /login)
    await page.goto('https://smartcorretorai.com/login', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });

    // Valida que a página carregou
    await expect(page).toHaveTitle(/SmartCorretor/i);

    // Aguarda o texto "Entrar na sua conta" aparecer (título da página de login)
    await expect(page.getByText('Entrar na sua conta')).toBeVisible({ timeout: 10000 });

    // Localiza os campos usando os placeholders específicos da LoginPage.jsx
    const emailInput = page.getByPlaceholder('seu@email.com');
    const passwordInput = page.getByPlaceholder('••••••••');
    
    // Valida que os campos existem e estão visíveis
    await expect(emailInput).toBeVisible({ timeout: 10000 });
    await expect(passwordInput).toBeVisible({ timeout: 10000 });

    // Tenta preencher os campos (sem submeter)
    await emailInput.fill('teste@exemplo.com');
    await passwordInput.fill('senha123');

    // Valida que o botão "Entrar" está presente
    const loginButton = page.getByRole('button', { name: /entrar/i });
    await expect(loginButton).toBeVisible();

    // Valida que não houve erros HTTP 500/502
    expect(httpErrors.length).toBe(0);
    
    // Valida que não houve erros críticos no console
    const criticalErrors = consoleErrors.filter(err => 
      err.includes('500') || 
      err.includes('502') || 
      err.includes('Failed to fetch') ||
      err.includes('Network error')
    );
    expect(criticalErrors.length).toBe(0);

    console.log('✅ TRAVA DE SEGURANÇA: Página de login carregou corretamente');
    console.log('✅ Campos de e-mail e senha encontrados e funcionais');
    console.log('✅ Botão de login presente');
    console.log(`📊 Erros HTTP capturados: ${httpErrors.length}`);
    console.log(`📊 Erros críticos no console: ${criticalErrors.length}`);
  });

  test('Deve validar que a página responde (não está offline)', async ({ page }) => {
    const response = await page.goto('https://smartcorretorai.com/login', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Valida que a resposta não é erro de servidor
    expect(response.status()).toBeLessThan(500);
    expect(response.ok() || response.status() === 304).toBeTruthy();

    console.log(`✅ Status HTTP: ${response.status()}`);
    console.log(`✅ Página de login acessível`);
  });

});
