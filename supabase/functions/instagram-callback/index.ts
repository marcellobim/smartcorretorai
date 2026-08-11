import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildFrontendInstagramRedirect, verifySignedOAuthState } from '../_shared/instagram/oauth.ts'
import { resolveInstagramConnection } from '../_shared/instagram/meta-client.ts'
import { handleInstagramCallback } from './runtime.ts'

const requiredEnv = (name: string) => {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`missing_${name.toLowerCase()}`)
  return value
}

serve(async request => {
  const frontendUrl = requiredEnv('FRONTEND_URL')
  const connectedRedirect = buildFrontendInstagramRedirect(frontendUrl, 'conectado')
  const errorRedirect = buildFrontendInstagramRedirect(frontendUrl, 'erro')
  const client = createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })

  return handleInstagramCallback(request, {
    connectedRedirect,
    errorRedirect,
    completeConnection: async (code, state) => {
      const payload = await verifySignedOAuthState(state, requiredEnv('META_OAUTH_STATE_SECRET'))
      const connection = await resolveInstagramConnection({
        code,
        userId: payload.userId,
        appId: requiredEnv('META_APP_ID'),
        appSecret: requiredEnv('META_APP_SECRET'),
        redirectUri: requiredEnv('META_REDIRECT_URI'),
        graphApiVersion: requiredEnv('META_GRAPH_API_VERSION'),
      })
      const { error } = await client.from('social_connections').upsert(connection, { onConflict: 'user_id,platform' })
      if (error) throw error
    },
    log: event => console.info(JSON.stringify({ event })),
  })
})
