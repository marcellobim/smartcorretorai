import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const payload = await req.json()
    const { categoria, tipo, dados, fotos_urls, redes_sociais } = payload

    // Gerar textos com GPT-4o
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1',
        messages: [
          {
            role: 'system',
            content: 'Você é um especialista em marketing imobiliário brasileiro. Gere textos persuasivos e profissionais para campanhas de imóveis.',
          },
          {
            role: 'user',
            content: `Crie textos de marketing para este imóvel:
Categoria: ${categoria}
Tipo: ${tipo}
Dados: ${JSON.stringify(dados)}

Retorne um JSON com:
{
  "titulo": "título impactante",
  "descricao": "descrição completa para anúncio",
  "instagram": "legenda para Instagram com emojis e hashtags",
  "whatsapp": "mensagem para WhatsApp",
  "facebook": "post para Facebook",
  "cta": "chamada para ação"
}`,
          },
        ],
        response_format: { type: 'json_object' },
      }),
    })

    const openaiData = await openaiRes.json()
    const textos_gerados = JSON.parse(openaiData.choices[0].message.content)

    // Salvar campanha no banco
    const { data: campanha, error: dbError } = await supabase
      .from('campaigns')
      .insert({
        user_id: user.id,
        titulo: textos_gerados.titulo,
        categoria,
        dados_imovel: { categoria, tipo, ...dados },
        textos_gerados,
        redes_sociais: redes_sociais || [],
        fotos_urls: fotos_urls || [],
        status: 'concluido',
      })
      .select()
      .single()

    if (dbError) throw dbError

    return new Response(JSON.stringify({ 
      success: true, 
      campanha, 
      textos: textos_gerados 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
