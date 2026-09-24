import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { probeMp4, parseMp4Structure, MP4_MAX_BYTES } from './mp4-probe.ts'
const u32=n=>{const b=Buffer.alloc(4);b.writeUInt32BE(n);return b}
const box=(type,...parts)=>{const body=Buffer.concat(parts);return Buffer.concat([u32(body.length+8),Buffer.from(type),body])}
const full=(type,...parts)=>box(type,u32(0),...parts)
// Structural fixture only; fake sample payloads are never decoded or uploaded.
function fixture(hevc=false){
 const head=box('ftyp',Buffer.from('isom'),u32(0),Buffer.from('isommp42'))
 const mdat=box('mdat',Buffer.alloc(192*4,1))
 const mdhd=Buffer.alloc(24);mdhd.writeUInt32BE(24000,12);mdhd.writeUInt32BE(192000,16)
 const hdlr=Buffer.alloc(12);hdlr.write('vide',8)
 const visual=Buffer.alloc(78);visual.writeUInt16BE(1,6);visual.writeUInt16BE(720,24);visual.writeUInt16BE(1280,26)
 const avcc=Buffer.from([1,66,0,30,255,225,0,1,103,1,0,1,104])
 const hvcc=Buffer.alloc(29);hvcc[0]=1;hvcc[21]=3;hvcc[22]=1;hvcc[23]=32;hvcc.writeUInt16BE(1,24);hvcc.writeUInt16BE(1,26);hvcc[28]=64
 const stbl=box('stbl',
  full('stsd',u32(1),box(hevc?'hvc1':'avc1',visual,box(hevc?'hvcC':'avcC',hevc?hvcc:avcc))),
  full('stts',u32(1),u32(192),u32(1000)),
  full('stsz',u32(4),u32(192)),
  full('stsc',u32(1),u32(1),u32(192),u32(1)),
  full('stco',u32(1),u32(head.length+8)))
 const dinf=box('dinf',full('dref',u32(1),box('url ',u32(1))))
 return Buffer.concat([head,mdat,box('moov',box('trak',box('mdia',box('mdhd',mdhd),box('hdlr',hdlr),box('minf',dinf,stbl))))])
}
const change=(data,fn)=>{const b=Buffer.from(data);fn(b);return b}
const pos=(b,tag)=>{const p=b.indexOf(tag);assert.ok(p>=0);return p}
test('valid H264 structural fixture and exact hash/output allowlist',async()=>{
 const b=fixture(),p=await probeMp4(b)
 assert.equal(p.codec,'h264');assert.equal(p.duration_ms,8000);assert.equal(p.fps,24)
 assert.equal(p.content_length,b.length);assert.equal(p.content_sha256,createHash('sha256').update(b).digest('hex'))
 assert.deepEqual(Object.keys(p).sort(),['container','codec','width','height','duration_ms','fps','content_length','content_sha256','parse_valid','integrity'].sort())
})
test('HEVC structural configuration accepted',async()=>assert.equal((await probeMp4(fixture(true))).codec,'hevc'))
test('existing public MP4 parses without artificial eight-second equality',async()=>{
 const b=readFileSync(new URL('../../../../frontend/public/demos-videos/video-campanha.mp4',import.meta.url))
 const p=await probeMp4(b);assert.equal(p.codec,'h264');assert.equal(p.duration_ms,10000);assert.equal(p.parse_valid,true)
})
for(const [name,mutate,reason] of [
 ['unsupported codec',b=>b.write('vp09',pos(b,'avc1')),/codec/],
 ['bad resolution',b=>b.writeUInt16BE(100,pos(b,'avc1')+28),/resolution/],
 ['missing metadata',b=>b.write('free',pos(b,'stts')),/stts/],
 ['FPS absent',b=>b.writeUInt32BE(0,pos(b,'stts')+16),/timing/],
 ['invalid offsets',b=>b.writeUInt32BE(b.length+100,pos(b,'stco')+12),/sample_outside_mdat/],
 ['sample mismatch',b=>b.writeUInt32BE(191,pos(b,'stsz')+12),/sample_sizes/],
 ['bad configuration',b=>b[pos(b,'avcC')+4]=0,/codec_config/],
 ['external data',b=>b.writeUInt32BE(0,pos(b,'url ')+4),/external_reference/],
 ['inconsistent duration',b=>b.writeUInt32BE(1,pos(b,'mdhd')+20),/duration_inconsistent/],
 ['oversized box',b=>b.writeUInt32BE(0xffffffff,0),/box_bounds/],
]){
 test(name,()=>assert.throws(()=>parseMp4Structure(change(fixture(),mutate)),reason))
}
test('truncation',()=>assert.throws(()=>parseMp4Structure(fixture().subarray(0,-1)),/box_bounds/))
test('duration excessive',()=>assert.throws(()=>parseMp4Structure(change(fixture(),b=>{
 b.writeUInt32BE(80000,pos(b,'stts')+16);b.writeUInt32BE(192*80000,pos(b,'mdhd')+20)
})),/duration/))
test('FPS outside range',()=>assert.throws(()=>parseMp4Structure(change(fixture(),b=>{
 b.writeUInt32BE(2000,pos(b,'stts')+16);b.writeUInt32BE(384000,pos(b,'mdhd')+20)
})),/fps/))
test('creator limit is applied without provider calls',()=>assert.throws(()=>parseMp4Structure(fixture(),7),/duration/))
test('invalid creator limit',()=>assert.throws(()=>parseMp4Structure(fixture(),NaN),/duration_limit/))
test('over 50 MiB rejects before parsing',()=>assert.throws(()=>parseMp4Structure(new Uint8Array(MP4_MAX_BYTES+1)),/size/))
test('fragmented MP4 rejected',()=>assert.throws(()=>parseMp4Structure(Buffer.concat([fixture(),box('moof')])),/fragmented/))
test('mvex rejected',()=>assert.throws(()=>parseMp4Structure(change(fixture(),b=>b.write('mvex',pos(b,'trak')))),/fragmented/))
test('URL/path cannot be inputs',()=>{for(const value of ['https://invalid.test','/media/private.mp4',{}])assert.throws(()=>parseMp4Structure(value),/bytes_required/)})
test('shared mutable memory rejected',()=>assert.throws(()=>parseMp4Structure(new Uint8Array(new SharedArrayBuffer(100))),/bytes_required/))
test('typed array offsets honored without hashing adjacent bytes',async()=>{
 const b=fixture(),wrapped=Buffer.concat([Buffer.alloc(10),b,Buffer.alloc(10)])
 assert.deepEqual(await probeMp4(wrapped.subarray(10,-10)),await probeMp4(b))
})
test('same-size substituted payload changes full-file hash',async()=>{
 const a=fixture(),b=change(a,b=>b[pos(b,'mdat')+12]^=1)
 assert.notEqual((await probeMp4(a)).content_sha256,(await probeMp4(b)).content_sha256)
})
test('Phase A rejects byte substitution before any provider call',async()=>{
 const {executeFileUpload}=await import('./file-upload.mjs')
 const a=fixture(),proof=await probeMp4(a),b=change(a,b=>b[pos(b,'mdat')+12]^=1)
 let providerCalled=false
 const result=await executeFileUpload({
  job:{status:'queued',init_attempts:0,environment:'sandbox',claim_token:'fixture',
   claim_expires_at:new Date(Date.now()+60000).toISOString(),content_length:a.length,content_sha256:proof.content_sha256},
  accessToken:'synthetic-unused',loadBytes:async()=>b,fetcher:async()=>{providerCalled=true;throw Error('unexpected')},
  repository:{transition:async(j,next)=>{assert.equal(next,'blocked');return {...j,status:next}}}
 })
 assert.equal(providerCalled,false);assert.equal(result.status,'blocked')
})
