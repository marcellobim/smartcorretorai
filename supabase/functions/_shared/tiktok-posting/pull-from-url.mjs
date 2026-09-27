import {fail,validateOptions} from './contract.mjs'
export async function executePullFromUrl({job,repository,accessToken,client,pullUrl,now=Date.now()}){
 if(job.status!=='queued'||job.init_attempts!==0||job.environment!=='sandbox'||!job.claim_token||!accessToken||typeof pullUrl!=='function'||!client?.init||Date.parse(job.claim_expires_at)<=now)fail('posting_not_ready')
 validateOptions(job.confirmed_options,job.creator_info_snapshot,job.duration_ms)
 job=await repository.transition(job,'initializing')
 const videoUrl=await pullUrl(job)
 const result=await client.init({accessToken,postInfo:job.confirmed_options,videoUrl})
 if(!result?.ok){const ambiguous=result?.error?.ambiguous===true;job=await repository.transition(job,ambiguous?'reconciliation_required':'failed',{errorCode:ambiguous?'init_ambiguous':'init_provider_rejected'});if(!ambiguous&&result.error?.providerCode){try{await repository.persistInitDiagnostic(job,{httpStatus:result.error.httpStatus,providerCode:result.error.providerCode,providerMessage:result.error.providerMessage,providerLogId:result.error.providerLogId})}catch{}}return {status:ambiguous?'reconciliation_required':'failed'}}
 await repository.transition(job,'processing',{publishId:result.publishId})
 return {status:'processing'}
}
