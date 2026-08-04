export const GEMINI_VIDEO_TEXT_RULES = [
  {
    codigo: 'camada_textual_unica',
    valor: 'O Gemini é o único responsável por renderizar os textos no vídeo final. Gerar exatamente uma única camada visual de textos, sem sobrepor, repetir ou duplicar legendas, finalidade, CTA ou telefone.',
  },
  {
    codigo: 'legendas_sem_duplicacao',
    valor: 'Quando as legendas estiverem ativas, renderizar cada legenda autorizada exatamente uma vez. Nunca repetir a mesma legenda nem criar uma segunda versão do mesmo texto.',
  },
  {
    codigo: 'cta_unico_e_literal',
    valor: 'Quando existir CTA no briefing, utilizar exclusivamente o CTA recebido, exatamente como informado e uma única vez. Quando não existir CTA, não criar nem exibir CTA.',
  },
  {
    codigo: 'telefone_exclusivamente_recebido',
    valor: 'Nunca criar, completar, inferir, corrigir ou substituir telefone. Exibir uma única vez exclusivamente o telefone recebido no briefing; se nenhum telefone tiver sido recebido, não exibir telefone, contato ou número fictício.',
  },
  {
    codigo: 'finalidade_exclusivamente_recebida',
    valor: 'Utilizar exclusivamente a finalidade recebida no briefing, sem inferir, substituir, reescrever ou duplicar essa informação.',
  },
  {
    codigo: 'nenhuma_informacao_fora_do_briefing',
    valor: 'Não escrever, narrar nem exibir nenhuma informação que não esteja explicitamente presente no briefing.',
  },
] as const

export const GEMINI_VIDEO_TEXT_RULES_PROMPT = `REGRAS GLOBAIS OBRIGATÓRIAS DE TEXTO NO VÍDEO
- O Gemini é o único responsável por renderizar os textos no vídeo final.
- Gere exatamente uma única camada visual de textos.
- Nunca duplique legendas, finalidade, CTA ou telefone.
- Utilize exclusivamente o CTA recebido no briefing e exiba-o exatamente uma vez. Se não houver CTA, não crie CTA.
- Nunca crie, complete, infira, corrija ou substitua telefone. Utilize exclusivamente o telefone recebido no briefing e exiba-o exatamente uma vez. Se não houver telefone, não exiba número ou contato.
- Utilize exclusivamente a finalidade recebida no briefing, sem inferir, substituir, reescrever ou duplicar.
- Não escreva, narre nem exiba nenhuma informação que não esteja explicitamente presente no briefing.`
