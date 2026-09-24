import {execFileSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {build} from '../../frontend/node_modules/esbuild/lib/main.js'
const git=(args)=>execFileSync('git',args,{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean)
const paths=[...new Set([...git(['diff','--name-only','0663d093']),...git(['ls-files','--others','--exclude-standard'])])]
const allowed=p=>p.startsWith('scripts/tiktok/')||p.startsWith('supabase/functions/tiktok-content-posting/')||
 ['docs/tiktok-direct-post-commercial-contract.md','docs/tiktok-video-imobiliario-direct-post.md','supabase/config.toml',
  'supabase/functions/_shared/tiktok-posting/repository.mjs','supabase/functions/_shared/tiktok-posting/creation-resolver.mjs',
  'supabase/functions/_shared/tiktok/tests/upgrade.test.ts','supabase/migrations/20260924010000_allow_tiktok_video_imobiliario.sql'].includes(p)
const patterns=[/\bsbp_[A-Za-z0-9]{20,}/,/\bsk-(?:proj-)?[A-Za-z0-9_-]{24,}/,/\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/,
/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/]
function scan(label,content) {assert.ok(!patterns.some(p=>p.test(content)),'credential pattern detected in '+label)}
for(const path of paths){assert.ok(allowed(path),'out-of-scope change: '+path);assert.ok(!/\.env(?:\.|$)/.test(path));scan(path,readFileSync(path,'utf8'))}
for(const slug of ['tiktok-callback','tiktok-connection','tiktok-content-posting']){
 const result=await build({entryPoints:['supabase/functions/'+slug+'/index.ts'],bundle:true,write:false,format:'esm',platform:'neutral',external:['npm:*'],target:'es2022',logLevel:'silent'})
 for(const out of result.outputFiles)scan(slug+' bundle',out.text)
}
execFileSync('git',['diff','--check','0663d093'],{stdio:'pipe'})
const canonical=execFileSync('git',['show','0663d093:supabase/migrations/20260923010000_create_tiktok_publish_jobs.sql'])
assert.equal(readFileSync('supabase/migrations/20260923010000_create_tiktok_publish_jobs.sql','utf8').replace(/\r\n/g,'\n'),canonical.toString())
console.log('PASS: '+paths.length+' changed files allowlisted; no private credential patterns/.env; 3 Edge bundles compiled/scanned; Phase A unchanged; diff clean')
