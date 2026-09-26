// Internal server adapter only. Never pass arbitrary client JSON to these RPCs.
export function postingRepository(admin) {
 const call=async(name,args)=>{
  const {data,error}=await admin.rpc(name,args)
  if(error||!data) throw new Error('posting_repository_unavailable')
  return data
 }
 return {
  create:job=>call('create_tiktok_publish_job',{p_job:job}),
  claim:(id,revision)=>call('claim_tiktok_publish_job',{p_id:id,p_revision:revision}),
  transition:(job,next,{publishId=null,providerStatus=null,errorCode=null}={})=>
   call('transition_tiktok_publish_job',{p_id:job.id,p_revision:job.revision,p_claim:job.claim_token,
    p_next:next,p_publish_id:publishId,p_provider_status:providerStatus,p_error_code:errorCode}),
  persistInitDiagnostic:(job,diagnostic)=>call('persist_tiktok_publish_init_diagnostic',{p_id:job.id,p_http_status:diagnostic.httpStatus,p_provider_error_code:diagnostic.providerCode,p_provider_error_message:diagnostic.providerMessage,p_provider_log_id:diagnostic.providerLogId}),
  closeIrrecoverable:(job,identity)=>call('close_irrecoverable_tiktok_publish_job',{p_id:job.id,p_user_id:identity.userId,p_environment:identity.environment,p_app_id:identity.appId}),
 }
}
