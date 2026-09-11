import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {sessionCookie} from './security.mjs'
// Run with PGLITE_MODULE pointing to an isolated @electric-sql/pglite installation.
const {PGlite}=await import(process.env.PGLITE_MODULE || '@electric-sql/pglite')
const sql=name=>readFileSync(new URL('../../supabase/migrations/'+name,import.meta.url),'utf8')
test('individual guest eligibility survives next day, expiry and cleanup; capacity stays separate',async()=>{
 const db=new PGlite()
 try {
 await db.exec("create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key); create function auth.role() returns text language sql as $$select 'service_role'::text$$;")
 await db.exec(sql('20260910010000_create_guest_banner_foundation.sql'))
 await db.exec(sql('20260911010000_cancel_guest_preprovider_reservation.sql'))
 await db.exec(sql('20260913010000_preserve_guest_promotion_eligibility.sql'))
 await db.exec('update public.guest_banner_policy set generation_enabled=true,daily_limit=1')
 const hash='a'.repeat(64), network='b'.repeat(64), other='c'.repeat(64)
 const rpc=async(query,params=[])=>(await db.query(query,params)).rows[0].result
 const open=(existing,fresh)=>rpc("select public.guest_banner_open($1,$2,$3,'guest_banner_started') result",[existing,fresh,network])
 const reserve=(h,key)=>rpc('select public.guest_banner_reserve($1,$2,$3) result',[h,network,key])
 assert.equal((await open(null,hash)).newSession,true)
 const first=await reserve(hash,'11111111-1111-4111-8111-111111111111')
 assert.equal(first.status,'reserved')
 // Database-only completion fixture: no renderer/provider calls.
 await db.query('select public.guest_banner_take_dispatch($1)',[first.requestId])
 await db.query("update public.guest_banner_requests set status='completed',completed_at=now() where id=$1",[first.requestId])
 assert.equal((await reserve(hash,'22222222-2222-4222-8222-222222222222')).error,'promotion_used')
 await open(null,other)
 assert.equal((await reserve(other,'33333333-3333-4333-8333-333333333333')).error,'promotion_capacity')
 // Move the completed promotion and aggregate to yesterday; individual remains used.
 await db.exec("update public.guest_banner_daily_costs set day=current_date-1")
 assert.equal((await reserve(hash,'44444444-4444-4444-8444-444444444444')).error,'promotion_used')
 await db.exec("update public.guest_banner_sessions set expires_at=now()-interval '8 days' where token_hash=repeat('a',64)")
 await db.query('select public.guest_banner_purge()')
 assert.equal((await open(hash,'d'.repeat(64))).newSession,false)
 assert.equal((await reserve(hash,'55555555-5555-4555-8555-555555555555')).error,'promotion_used')
 assert.equal((await reserve(other,'66666666-6666-4666-8666-666666666666')).status,'reserved')
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

test('used guest returns promotion_used before rate, preparation or capacity',async()=>{
 const {handleGuestBanner}=await import('../../supabase/functions/gerar-hero-ia/guest-runtime.ts')
 const db={from(table){const row=table==='guest_banner_sessions'?{id:'session',expires_at:'2099-01-01'}:{id:'request',status:'completed',client_request_id:'11111111-1111-4111-8111-111111111111'}; const query={select(){return query},eq(){return query},gt(){return query},neq(){return query},async maybeSingle(){return {data:row}}};return query},storage:{from(){return {}}},rpc(){throw Error('rate/capacity must not run')}}
 const result=await handleGuestBanner({action:'guest_generate',sessionHash:'a'.repeat(64),networkHash:'b'.repeat(64),claimHash:'c'.repeat(64),clientRequestId:'22222222-2222-4222-8222-222222222222'},db,{prepare(){throw Error('prepare must not run')}})
 assert.deepEqual(result,{error:'promotion_used'})
})
