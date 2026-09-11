import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {recoverSmartTourSocialMetadata} from '../../supabase/functions/_shared/smart-tour/social-metadata.ts'
import {buildSmartTourPublicationOptions} from '../../supabase/functions/_shared/smart-tour/publication-options.ts'
import {publishSmartTourPublication} from '../src/lib/smart-tour-social-publish.js'
const id='13e01478-a799-422d-b2f8-efc1a13876a6'
const briefing={versao:'smart-tour-structured-briefing-v1',configuracoes:{idioma:'pt-BR'},imovel:{finalidade:'Venda',tipo:'Casa',localizacao:{cidade:'Campinas',estado:'SP',bairro:''},destaques:[]},cta:{titulo:'',telefone:''}}
const job={id,user_id:'owner',status:'completed',mode:'smart_tour_gemini_omni',output_video_path:`owner/${id}/smart-tour.mp4`,publication_options:[],output_media_metadata:null,prompt_final:JSON.stringify(briefing)}
const media={contentType:'video/mp4',contentLength:1200}
test('legacy valid MP4 recovers deterministic official options and preserves existing metadata',()=>{
 const result=recoverSmartTourSocialMetadata(job,media)
 assert.equal(result.output_media_metadata.mime_type,'video/mp4')
 assert.deepEqual(result.publication_options,buildSmartTourPublicationOptions({property:{purpose:'sale',type:'Casa',city:'Campinas',state:'SP',highlights:[]},language:'pt-BR',cta:'',phone:''}))
 assert.deepEqual(recoverSmartTourSocialMetadata({...job,...result},media),result)
})
test('recovery rejects wrong owner/path, unfinished video, unsupported source and malformed options',()=>{
 for(const patch of [{user_id:'other'},{status:'failed'},{mode:'free_ai'},{publication_options:[{}]},{prompt_final:'{}'},{output_media_metadata:{mime_type:'image/jpeg'}}]) assert.equal(recoverSmartTourSocialMetadata({...job,...patch},media),null)
 assert.equal(recoverSmartTourSocialMetadata(job,{...media,contentLength:0}),null)
 assert.equal(recoverSmartTourSocialMetadata(job,{...media,contentType:'image/jpeg'}),null)
})
test('future official generation persists canonical options and MIME from delivered output',()=>{
 const source=readFileSync(new URL('../../supabase/functions/smart-tour-generate/index.ts',import.meta.url),'utf8')
 assert.match(source,/publication_options:buildSmartTourPublicationOptions/)
 assert.match(source,/output_media_metadata:\{mime_type:generated.contentType\}/)
})
test('409 identity invalid survives Supabase error body and stops confirming in actual dialog catch',async()=>{
 const client={auth:{getSession:async()=>({data:{session:{access_token:'local-only'}}})},functions:{invoke:async()=>({data:null,error:{context:new Response(JSON.stringify({code:'video_publication_identity_invalid'}),{status:409})}})}}
 let failure
 try {await publishSmartTourPublication(client,{sourceType:'video_imobiliario',sourceId:id,mediaAssetId:id,optionId:'smart-tour-caption-option-1',captionSnapshot:''},['instagram','facebook'])}catch(error){failure=error}
 assert.equal(failure.code,'video_publication_identity_invalid')
 const source=readFileSync(new URL('../src/components/campaign/BannerPublishDialog.jsx',import.meta.url),'utf8')
 const block=source.split('} catch (error) {')[1].split('} finally {')[0]
 const state={};const ref={current:true}
 new Function('error','intent','setDefinitiveError','setConfirmationPending','setSubmissionStarted','submissionLockRef',block)(failure,{sourceType:'video_imobiliario'},v=>state.message=v,v=>state.confirming=v,v=>state.started=v,ref)
 assert.equal(state.confirming,false);assert.equal(state.started,false);assert.equal(ref.current,false)
 assert.ok(state.message);assert.doesNotMatch(state.message,/409|identity_invalid/)
})
