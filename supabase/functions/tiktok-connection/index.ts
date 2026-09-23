import { createClient } from 'npm:@supabase/supabase-js@2'
import { loadTikTokConfiguration } from '../_shared/tiktok/environment.ts'
import { createTikTokRepositories } from '../_shared/tiktok/repository.ts'

const required = (name: string) => {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error('missing_' + name.toLowerCase())
  return value
}
const config = await loadTikTokConfiguration(name => Deno.env.get(name))
const admin = createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })
const repositories = createTikTokRepositories(admin, config)
import { createTikTokConnectionHandler } from './handler.ts'
const handler = createTikTokConnectionHandler({
  ...config, identity: config,
  stateRepository: repositories.stateRepository,
  statusRepository: repositories.statusRepository,
  async authenticate(accessToken) {
    const { data, error } = await admin.auth.getUser(accessToken)
    return error || !data.user ? null : { userId: data.user.id }
  },
  log: message => console.info(message),
})
Deno.serve(handler)
