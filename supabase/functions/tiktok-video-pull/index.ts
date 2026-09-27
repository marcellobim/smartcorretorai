const enc=new TextEncoder(),uuid=(v:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
const reject=()=>new Response('Not found',{status:404,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})
const b64=(b:Uint8Array)=>btoa(String.fromCharCode(...b)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'')
const sign=async(key:string,id:string,e:number)=>b64(new Uint8Array(await crypto.subtle.sign('HMAC',await crypto.subtle.importKey('raw',enc.encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']),enc.encode(`tiktok-pull-v1:${id}:${e}`))))
const equal=(a:string,b:string)=>a.length===b.length&&[...a].every((v,i)=>v===b[i])
Deno.serve(async req=>{const u=new URL(req.url),id=u.searchParams.get('j')||'',e=Number(u.searchParams.get('e')),s=u.searchParams.get('s')||'',base=(Deno.env.get('SUPABASE_URL')||'').replace(/\/$/,''),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''
 if(req.method!=='GET'||u.pathname!=='/tiktok-video-pull'||!base||!key||!uuid(id)||!Number.isSafeInteger(e)||e<=Math.floor(Date.now()/1000)||e>Math.floor(Date.now()/1000)+7200||s.length!==43||!equal(s,await sign(key,id,e)))return reject()
 const rows=await fetch(`${base}/rest/v1/tiktok_publish_jobs?id=eq.${encodeURIComponent(id)}&select=id,user_id,creation_id,status,object_path,content_type,content_length`,{headers:{apikey:key,Authorization:`Bearer ${key}`}}).then(r=>r.ok?r.json():[]).catch(()=>[]),j=Array.isArray(rows)?rows[0]:null,path=j&&`${j.user_id}/${j.creation_id}/smart-tour.mp4`
 if(!j||!['initializing','processing','reconciliation_required'].includes(j.status)||j.object_path!==path||j.content_type!=='video/mp4'||!Number.isSafeInteger(j.content_length)||j.content_length<=0)return reject()
 const object=await fetch(`${base}/storage/v1/object/authenticated/studio-videos/${path.split('/').map(encodeURIComponent).join('/')}`,{headers:{apikey:key,Authorization:`Bearer ${key}`},signal:req.signal}).catch(()=>null)
 if(!object?.ok||!object.body||!(object.headers.get('content-type')||'').startsWith('video/mp4'))return reject()
 const h=new Headers({'Content-Type':'video/mp4','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}),n=object.headers.get('content-length')||String(j.content_length);if(/^\d+$/.test(n))h.set('Content-Length',n);return new Response(object.body,{status:200,headers:h})
})
