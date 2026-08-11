import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildFrontendInstagramRedirect, verifySignedOAuthState } from '../_shared/instagram/oauth.ts'
import { resolveInstagramConnection } from '../_shared/instagram/meta-client.ts'
import {
  InstagramOAuthTelemetryError,
  logInstagramOAuthEvent,
  type InstagramOAuthTelemetryEvent,
} from '../_shared/instagram/telemetry.ts'
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
  const log = (event: InstagramOAuthTelemetryEvent) => logInstagramOAuthEvent(message => console.info(message), event)

  return handleInstagramCallback(request, {
    connectedRedirect,
    errorRedirect,
    completeConnection: async (code, state) => {
      let payload
      try {
        payload = await verifySignedOAuthState(state, requiredEnv('META_OAUTH_STATE_SECRET'))
      } catch {
        throw new InstagramOAuthTelemetryError({ stage: 'state' })
      }
      const connection = await resolveInstagramConnection({
        code,
        userId: payload.userId,
        appId: requiredEnv('META_APP_ID'),
        appSecret: requiredEnv('META_APP_SECRET'),
        redirectUri: requiredEnv('META_REDIRECT_URI'),
        graphApiVersion: requiredEnv('META_GRAPH_API_VERSION'),
        telemetry: log,
      })
      const { error } = await client.from('social_connections').upsert(connection, { onConflict: 'user_id,platform' })
      if (error) throw new InstagramOAuthTelemetryError({ stage: 'database', supabase_code: error.code })
    },
    log,
  })
})
