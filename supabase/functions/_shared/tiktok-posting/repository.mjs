// Internal server adapter only. Never pass arbitrary client JSON to these RPCs.
export function postingRepository(admin) {
 const call=async(name,args)=>{
  const {data,error}=await admin.rpc(name,args)
  if(error?.message==='posting_idempotency_conflict') throw new Error('posting_idempotency_conflict')
  if(error||!data) throw new Error('posting_repository_unavailable')
  return data
 }
 return {
  create:job=>call('create_tiktok_publish_job',{p_job:job}),
  claim:(id,revision)=>call('claim_tiktok_publish_job',{p_id:id,p_revision:revision}),
  transition:(job,next,{publishId=null,providerStatus=null,errorCode=null}={})=>
   call('transition_tiktok_publish_job',{p_id:job.id,p_revision:job.revision,p_claim:job.claim_token,
    p_next:next,p_publish_id:publishId,p_provider_status:providerStatus,p_error_code:errorCode}),
 }
}
