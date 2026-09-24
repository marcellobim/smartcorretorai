const uuid = v => typeof v==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
const fields = {prepare:['action','creation_id'],confirm:['action','creation_id','idempotency_key','preparation','options','consent'],status:['action','job_id']}
export function createPostingHandler({authorize,service,origin}) {
 return async request => {
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'}
  if(request.headers.get('origin')===origin)headers['Access-Control-Allow-Origin']=origin
  const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers})
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers})
  if(request.method!=='POST')return reply(405,{error:'method_not_allowed'})
  const jwt=/^Bearer (\S+)$/i.exec(request.headers.get('authorization')||'')?.[1]
  if(!jwt)return reply(401,{error:'authentication_required'})
  let identity
  try{identity=await authorize(jwt)}catch{return reply(403,{error:'admin_mfa_required'})}
  let input
  try{
   const raw=await request.text();if(raw.length>12000)throw Error()
   input=JSON.parse(raw);const allowed=fields[input?.action]
   if(!allowed||Object.keys(input).length!==allowed.length||Object.keys(input).some(k=>!allowed.includes(k)))throw Error()
   if(!uuid(input.action==='status'?input.job_id:input.creation_id))throw Error()
   if(input.action==='confirm'&&(!uuid(input.idempotency_key)||typeof input.preparation!=='string'||input.preparation.length>4096))throw Error()
  }catch{return reply(400,{error:'invalid_input'})}
  try{return reply(200,await service[input.action](identity,input))}
  catch(error){
   const safe=['reauthorization_required','creation_unavailable','media_changed','preparation_expired','invalid_options','rate_limit','creator_restriction','invalid_media','idempotency_conflict']
   const code=safe.includes(error?.message)?error.message:'posting_unavailable'
   return reply(code==='rate_limit'?429:code==='reauthorization_required'?409:400,{error:code})
  }
 }
}
