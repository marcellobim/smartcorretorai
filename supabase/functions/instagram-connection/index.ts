import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildFacebookOAuthUrl, createSignedOAuthState } from '../_shared/instagram/oauth.ts'
import { handleInstagramConnection } from './runtime.ts'

const requiredEnv = (name: string) => {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`missing_${name.toLowerCase()}`)
  return value
}

serve(async request => {
  try {
    const client = () => createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })

    return await handleInstagramConnection(request, {
      authenticate: async token => {
        const { data: { user }, error } = await client().auth.getUser(token)
        return error || !user ? null : { id: user.id }
      },
      createAuthorizationUrl: async userId => buildFacebookOAuthUrl({
        appId: requiredEnv('META_APP_ID'),
        redirectUri: requiredEnv('META_REDIRECT_URI'),
        graphApiVersion: requiredEnv('META_GRAPH_API_VERSION'),
        state: await createSignedOAuthState({ userId, secret: requiredEnv('META_OAUTH_STATE_SECRET') }),
      }),
      getConnection: async userId => {
        const { data, error } = await client()
          .from('social_connections')
          .select('ig_username,token_expires_at')
          .eq('user_id', userId)
          .eq('platform', 'instagram')
          .maybeSingle()
        if (error) throw error
        return data
      },
      deleteConnection: async userId => {
        const { error } = await client()
          .from('social_connections')
          .delete()
          .eq('user_id', userId)
          .eq('platform', 'instagram')
        if (error) throw error
      },
      log: event => console.info(JSON.stringify({ event })),
    })
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'Configuração indisponível.' }), {
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
    })
  }
})
