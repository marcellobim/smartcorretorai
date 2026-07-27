# SmartCorretorAI — política permanente de segurança

Estas regras valem para todo o repositório: frontend, backend, Edge Functions, testes, commits e deploys.

- Nunca exponha API keys privadas, service role, tokens, secrets, credenciais, senhas, URLs assinadas permanentes ou informações sensíveis.
- Nunca coloque credenciais privadas ou lógica sensível no React, em arquivos públicos ou no bundle do navegador.
- Operações que dependam de credenciais devem permanecer exclusivamente no backend ou em Edge Functions.
- Nunca registre chaves completas, tokens, secrets ou credenciais em logs. Quando um identificador for indispensável, masque-o.
- Antes de cada commit, revise todos os arquivos alterados, procure exposição de segredos e confirme que nenhum `.env` com valores privados está sendo adicionado.
- Antes de entregar um build, verifique que nenhuma chave privada foi incluída nos artefatos finais.
- Antes de qualquer deploy, confirme que nenhuma variável sensível será publicada. Nunca execute deploy sem solicitação explícita do usuário.
- Não execute operações pagas, incluindo gerações de imagem ou vídeo, sem autorização explícita do usuário.
