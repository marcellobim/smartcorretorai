import { createTikTokUpgradeRepository } from '../_shared/tiktok/upgrade.ts'
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
const upgrade = createTikTokUpgradeRepository(admin, config)
import { createTikTokCallbackHandler } from './handler.ts'
import { loadTikTokTokenKeyringFromEnvironment } from '../_shared/tiktok/token-crypto.ts'
const handler = createTikTokCallbackHandler({
  ...config, identity: config,
  stateRepository: repositories.stateRepository,
  persistLogin: repositories.persistLogin,
  consumeUpgrade: upgrade.consume,
  persistUpgrade: upgrade.persist,
  tokenKeyring: await loadTikTokTokenKeyringFromEnvironment(name => Deno.env.get(name)),
  fetcher: fetch,
  log: message => console.info(message),
})
Deno.serve(handler)
