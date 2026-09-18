export const owner='11111111-1111-4111-8111-111111111111'
export const calls={auth:0,uploads:0,lists:0,generation:0,status:0}
export const mode=new URLSearchParams(location.search).get('mode') || 'invalid'
const report=()=>{document.getElementById('calls').textContent=JSON.stringify(calls)}
export const supabase={
 auth:{getUser:async()=>{calls.auth++;report();return mode==='invalid'?{data:{user:null},error:{code:'session_not_found',status:403}}:{data:{user:{id:owner}}}},signOut:async()=>({error:null})},
 storage:{from:()=>({list:async()=>{calls.lists++;report();return {data:Array.from({length:5},(_,i)=>({name:`0${i+1}.jpg`,id:'synthetic-object'}))}},upload:async()=>{calls.uploads++;report();throw Error('unexpected upload in reuse test')}})},
 functions:{invoke:async(name,{body})=>{if(name==='smart-tour-status'){calls.status++;report();return {data:{ok:true,status:'failed',error:'Fim do teste simulado; nenhum provider foi chamado.'}}}if(name!=='smart-tour-generate')throw Error('unexpected function');calls.generation++;report();if(mode==='invalid-at-invoke')return {data:null,error:{message:'Edge Function returned a non-2xx status code',context:new Response(JSON.stringify({error_code:'session_not_found'}),{status:401})}};return {data:{ok:true,jobId:body.clientRequestId,status:'generating'}}}}
}
export const useAuth=()=>({user:{id:owner},reloadProfile:async()=>{}})
export const useOptionalAuth=()=>null
export const useAccountAnalytics=()=>({trackGenerationClicked:()=>{}})
export const useAuthStore=useAuth; export const AuthProvider=({children})=>children
