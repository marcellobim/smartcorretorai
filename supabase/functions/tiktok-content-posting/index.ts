import { createClient } from 'npm:@supabase/supabase-js@2'
import { loadTikTokConfiguration } from '../_shared/tiktok/environment.ts'
import { loadTikTokTokenKeyringFromEnvironment, decryptTikTokToken } from '../_shared/tiktok/token-crypto.ts'
import { createPostingClient } from '../_shared/tiktok-posting/posting-client.mjs'
import { postingRepository } from '../_shared/tiktok-posting/repository.mjs'
import { creationResolver } from '../_shared/tiktok-posting/creation-resolver.mjs'
import { probeMp4 } from '../_shared/tiktok-posting/mp4-probe.ts'
import { createContentPostingHandler } from './handler.mjs'
import { storageAdapters } from './storage.mjs'

const required = (name: string) => {
 const value = Deno.env.get(name)?.trim()
 if (!value) throw new Error('missing_configuration')
 return value
}
const config = await loadTikTokConfiguration(name => Deno.env.get(name))
if (config.environment !== 'sandbox') throw new Error('posting_sandbox_required')
const keyring = await loadTikTokTokenKeyringFromEnvironment(name => Deno.env.get(name))
const serviceKey = required('SUPABASE_SERVICE_ROLE_KEY')
const supabaseUrl = required('SUPABASE_URL')
const admin = createClient(supabaseUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}})
const storage = storageAdapters({admin,supabaseUrl,serviceKey,fetcher:fetch})
const resolveTikTokPublishableCreation = creationResolver({
 async readCreation(id: string,userId: string) {
  const {data,error} = await admin.from('video_jobs').select('id,user_id,status,mode,output_video_path')
   .eq('id',id).eq('user_id',userId).maybeSingle()
  if (error) throw new Error('posting_creation_invalid')
  return data
 },
 inspectObject:storage.inspectObject,
})
Deno.serve(createContentPostingHandler({
 ...config,auth:admin,admin,resolveTikTokPublishableCreation,
 ...storage,probe:probeMp4,fetcher:fetch,client:createPostingClient({fetcher:fetch}),
 repository:postingRepository(admin),
 async readJob(id: string,identity: {userId:string;environment:string;appId:string}) {
  const {data,error} = await admin.from('tiktok_publish_jobs').select('*')
   .eq('id',id).eq('user_id',identity.userId).eq('environment',identity.environment).eq('app_id',identity.appId).maybeSingle()
  if (error) throw new Error('posting_job_unavailable')
  return data
 },
 async readConnection(identity: {userId:string;environment:string;appId:string},connectionId?: string) {
  let query = admin.from('tiktok_connections').select('*').eq('user_id',identity.userId)
   .eq('environment',identity.environment).eq('app_id',identity.appId).eq('connection_status','active')
  if (connectionId) query = query.eq('id',connectionId)
  const {data,error} = await query.order('updated_at',{ascending:false}).limit(1).maybeSingle()
  if (error) throw new Error('posting_reauthorization_required')
  return data
 },
 async decrypt(connection: Record<string, any>,identity: {userId:string;environment:'sandbox';appId:string}) {
  return await decryptTikTokToken({
   algorithm:'AES-256-GCM',ciphertext:connection.access_token_ciphertext,nonce:connection.access_token_nonce,
   authTag:connection.access_token_auth_tag,keyVersion:connection.key_version,
  },keyring,{...identity,openId:connection.open_id,kind:'access'})
 },
}))
