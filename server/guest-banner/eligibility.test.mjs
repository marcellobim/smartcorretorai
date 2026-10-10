import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {sessionCookie} from './security.mjs'
// Run with PGLITE_MODULE pointing to an isolated @electric-sql/pglite installation.
const {PGlite}=await import(process.env.PGLITE_MODULE || '@electric-sql/pglite')
const sql=name=>readFileSync(new URL(name.startsWith('20260913')||name.startsWith('20260914')?'../../experiments/deferred-migrations/guest-banner/'+name:'../../supabase/migrations/'+name,import.meta.url),'utf8')
test('different guests share a day; only success consumes individual eligibility',async()=>{
 const db=new PGlite()
 try {
 await db.exec("create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key); create function auth.role() returns text language sql as $$select 'service_role'::text$$;")
 for(const name of ['20260910010000_create_guest_banner_foundation.sql','20260911010000_cancel_guest_preprovider_reservation.sql','20260912010000_allow_pending_guest_provider_cost.sql','20260913010000_preserve_guest_promotion_eligibility.sql','20260914010000_guest_success_only_no_global_cap.sql']) await db.exec(sql(name))
 await db.exec('update public.guest_banner_policy set generation_enabled=true,daily_limit=1')
 const hash='a'.repeat(64), network='b'.repeat(64), other='c'.repeat(64)
 const rpc=async(query,params=[])=>(await db.query(query,params)).rows[0].result
 const open=(existing,fresh)=>rpc("select public.guest_banner_open($1,$2,$3,'guest_banner_started') result",[existing,fresh,network])
 const key=n=>`${n}`.repeat(8)+'-1111-4111-8111-111111111111'
 const reserve=(h,n)=>rpc('select public.guest_banner_reserve($1,$2,$3) result',[h,network,key(n)])
 const dispatch=id=>rpc('select public.guest_banner_take_dispatch($1) result',[id])
 const finish=(id,status,cost)=>rpc('select public.guest_banner_finish($1,$2,$3,$4,$5) result',[id,status,status==='completed'?id:null,status==='completed'?'d'.repeat(64):null,cost])
 await open(null,hash); await open(null,other)
 const first=await reserve(hash,1), second=await reserve(other,2)
 assert.equal(first.status,'reserved'); assert.equal(second.status,'reserved')
 assert.equal((await reserve(hash,3)).requestId,first.requestId) // concurrent new key reuses active job
 assert.equal(await dispatch(first.requestId),true)
 assert.equal(await dispatch(first.requestId),false) // no duplicate dispatch
 assert.equal(await finish(first.requestId,'failed',123),true)
 assert.equal((await reserve(hash,1)).status,'failed') // same key never dispatches twice
 const retry=await reserve(hash,3)
 assert.equal(retry.status,'reserved');assert.notEqual(retry.requestId,first.requestId)
 await db.exec('update public.guest_banner_policy set daily_limit=0') // obsolete cap cannot disable dispatch
 assert.equal(await dispatch(retry.requestId),true)
 assert.equal(await finish(retry.requestId,'completed',456),true)
 assert.equal((await reserve(hash,4)).error,'promotion_used')
 assert.equal((await reserve(other,5)).requestId,second.requestId) // B retains its own opportunity
 await rpc('select public.guest_banner_cancel_preprovider($1,$2) result',[other,second.requestId])
 assert.equal((await reserve(other,6)).status,'reserved') // B can still proceed despite A success
 assert.equal((await db.query('select cost_microusd from public.guest_banner_daily_costs')).rows[0].cost_microusd,579)
 await db.exec("update public.guest_banner_daily_costs set day=current_date-1; update public.guest_banner_sessions set expires_at=now()-interval '8 days' where token_hash=repeat('a',64)")
 await db.query('select public.guest_banner_purge()')
 assert.equal((await open(hash,'e'.repeat(64))).newSession,false)
 assert.equal((await reserve(hash,7)).error,'promotion_used')
 assert.doesNotMatch((await db.query("select pg_get_functiondef('public.guest_banner_reserve(text,text,uuid)'::regprocedure) as definition")).rows[0].definition,/promotion_capacity/)
 }finally{await db.close()}
})

test('existing opaque cookie persists across daily boundaries',()=>{
 const now=Date.now()
 assert.match(sessionCookie('a'.repeat(43),new Date(now+86400000).toISOString(),now),/Max-Age=34560000; HttpOnly; Secure; SameSite=Lax/)
})
test('client distinguishes used promotion from global capacity',async()=>{
 const source=readFileSync(new URL('../../frontend/src/lib/guest-banner-client.js',import.meta.url),'utf8')
 const block=source.slice(source.indexOf('export async function guestBannerRequest'),source.indexOf('export function guestResultForBanner')).replace('export async','async')
 for(const code of ['promotion_used','promotion_capacity']){
  const request=new Function('fetch',block+';return guestBannerRequest')(async()=>({ok:true,json:async()=>({error:code})}))
  await assert.rejects(request('generate'),e=>e.code===code && (code==='promotion_used' ? e.message==='Seu teste grátis já foi utilizado. Crie sua conta para continuar criando.' : /capacidade/.test(e.message)))
 }
})

test('success consumes the test while in-flight requests only replay without another dispatch',async()=>{
 for(const status of ['completed','reserved','dispatching','unknown']){
 const {handleGuestBanner}=await import('../../supabase/functions/gerar-hero-ia/guest-runtime.ts')
 const db={from(table){const row=table==='guest_banner_sessions'?{id:'session',expires_at:'2099-01-01'}:{id:'request',status,client_request_id:'11111111-1111-4111-8111-111111111111'}; const query={select(){return query},eq(){return query},gt(){return query},neq(){return query},in(){return query},async maybeSingle(){return {data:row}}};return query},storage:{from(){return {}}},rpc(){throw Error('rate/capacity must not run')}}
 const result=await handleGuestBanner({action:'guest_generate',sessionHash:'a'.repeat(64),networkHash:'b'.repeat(64),claimHash:'c'.repeat(64),clientRequestId:'22222222-2222-4222-8222-222222222222'},db,{prepare(){throw Error('prepare must not run')}})
 assert.deepEqual(result,status==='completed'?{error:'promotion_used'}:{requestId:'request',status,replayed:true})
 }
})

test('completed provider response without an artifact becomes retryable failure, not used promotion',async()=>{
 const {handleGuestBanner}=await import('../../supabase/functions/gerar-hero-ia/guest-runtime.ts')
 let finished
 const db={from(table){const row=table==='guest_banner_sessions'?{id:'session',expires_at:'2099-01-01'}:{id:'request',status:'dispatching'};const q={select(){return q},eq(){return q},gt(){return q},neq(){return q},order(){return q},limit(){return q},async maybeSingle(){return {data:row}}};return q},storage:{from(){return {async download(){return {data:{text:async()=>JSON.stringify({responseId:'local-response',briefing:{}})}}}}}},async rpc(name,args){assert.equal(name,'guest_banner_finish');finished=args;return {data:true}}}
 const result=await handleGuestBanner({action:'guest_status',sessionHash:'a'.repeat(64)},db,{poll:async()=>({status:'completed'}),result(){throw Error('guest_result_missing')},dispatch(){throw Error('no new generation allowed')}})
 assert.deepEqual(result,{status:'failed',requestId:'request'})
 assert.equal(finished.p_status,'failed');assert.equal(finished.p_artifact_ref,null)
})
