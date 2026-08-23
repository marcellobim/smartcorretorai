# Recuperação segura de MFA administrativo

O acesso administrativo exige simultaneamente uma linha válida em `admin_users` e um JWT Supabase com `aal2`. Não existe bypass por metadata, e-mail ou estado do frontend.

Se um administrador perder todos os autenticadores:

1. confirmar a identidade do titular por um procedimento interno fora do produto;
2. no Supabase Dashboard, localizar exatamente o usuário autenticado;
3. revogar somente o fator TOTP perdido desse usuário;
4. não remover a exigência de AAL2 e não promover outra conta por conveniência;
5. pedir ao administrador que entre novamente e cadastre um novo fator;
6. confirmar que o novo acesso ao Admin alcança `aal2`;
7. registrar operador, usuário, motivo e horário da intervenção sem armazenar QR Code, segredo TOTP ou códigos de uso único.

Se a identidade não puder ser confirmada, o fator não deve ser removido. A recuperação deve ser tratada como ação privilegiada e nunca automatizada por e-mail comum.
