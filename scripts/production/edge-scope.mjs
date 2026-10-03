export const BANNER_RECOVERY_RELEASE = Object.freeze({
 baseSha:'6d3d74d47760d134077b9695f4a46faec976be7d',
 functionalSha:'b82861e783d2eb81f61a59a230fbf7f1bd2bd167',
 frontendDeploymentId:'dpl_9Jb1FwCYKyRpH8m5MdutBJiJ4Z2m',
 edgeVersion:74,
 projectRef:'sfbowejaevlmhcvsxhbk',
 functionName:'gerar-hero-ia',
 functionalPaths:Object.freeze([
  'frontend/src/pages/HeroNext.jsx',
  'frontend/tests/banner-frontend-recovery.test.mjs',
  'supabase/functions/gerar-hero-ia/index.ts',
  'supabase/functions/gerar-hero-ia/recover-batch.test.mjs',
 ]),
 gatePaths:Object.freeze([
  'scripts/production/deploy.mjs',
  'scripts/production/edge-scope.mjs',
  'scripts/production/banner-recovery-release.test.mjs',
 ]),
})

const releaseModes=['--video-social-metadata','--admin-api','--tiktok-content-posting','--banner-recovery-hotfix','--banner-recovery-promote']

export function deploymentMode(args){
 const modes=[]
 for(let index=0;index<args.length;index++){
  const arg=args[index]
  if(arg==='--target'){
   const name=args[++index]
   deploymentTarget(['--target',name])
   continue
  }
  if(arg==='--candidate-only')continue
  if(!releaseModes.includes(arg))throw Error('DEPLOY BLOQUEADO: opção desconhecida')
  modes.push(arg)
 }
 if(modes.length>1)throw Error('DEPLOY BLOQUEADO: selecione apenas um escopo de publicação')
 return modes[0]||'frontend'
}

export function edgeScope(args) {
 const mode=deploymentMode(args)
 if(mode==='--admin-api')return ['admin-api']
 if(mode==='--tiktok-content-posting')return ['tiktok-content-posting']
 if(mode==='--video-social-metadata')return ['smart-tour-generate','social-publish-video']
 if(mode==='--banner-recovery-hotfix')return [BANNER_RECOVERY_RELEASE.functionName]
 return []
}

export function adminApiVersion(functions) {
 const admin=functions.find(f=>f.slug==='admin-api')
 if(!admin||admin.verify_jwt!==true||admin.status!=='ACTIVE'||!Number.isSafeInteger(admin.version))throw Error('DEPLOY BLOQUEADO: admin-api deve estar ativa com JWT habilitado')
 return admin.version
}

export function tiktokContentPostingVersion(functions) {
 const posting=functions.find(f=>f.slug==='tiktok-content-posting')
 if(!posting||posting.verify_jwt!==true||posting.status!=='ACTIVE'||!Number.isSafeInteger(posting.version))throw Error('DEPLOY BLOQUEADO: tiktok-content-posting deve estar ativa com JWT habilitado')
 return posting.version
}

export function bannerFunctionVersion(functions,expectedVersion=null){
 const banner=functions.find(f=>f.slug===BANNER_RECOVERY_RELEASE.functionName)
 if(!banner||banner.verify_jwt!==false||banner.status!=='ACTIVE'||!Number.isSafeInteger(banner.version))throw Error('DEPLOY BLOQUEADO: gerar-hero-ia deve estar ativa com verify_jwt=false')
 if(expectedVersion!==null&&banner.version!==expectedVersion)throw Error('DEPLOY BLOQUEADO: versão de gerar-hero-ia difere do baseline aprovado')
 return banner.version
}

const normalizePath=value=>String(value||'').trim().replaceAll('\\','/')

function blockedPathReason(file){
 const checks=[
  [/^supabase\/migrations\//,'migration'],
  [/^frontend\/src\/App\.jsx$/,'App.jsx'],
  [/^supabase\/config\.toml$/,'config.toml'],
  [/(^|\/)(tiktok-connection|tiktok-callback)(\/|$)|_shared\/tiktok|TikTokIntegration|config\/tiktok|tiktok-oauth-connection|create_isolated_tiktok_login_kit/i,'TikTok'],
  [/(^|\/)(instagram-connection|instagram-callback|instagram-publish)(\/|$)|_shared\/instagram|meta-oauth|social-publish-|social-media-lease/i,'Meta/social'],
  [/(^|[\/._-])(workers?|jobs?|cron)([\/._-]|$)/i,'worker/job/cron'],
 ]
 return checks.find(([pattern])=>pattern.test(file))?.[1]||'arquivo fora da allowlist'
}

export function validateBannerRecoveryManifest(paths){
 const actual=[...new Set(paths.map(normalizePath).filter(Boolean))].sort()
 if(actual.length!==paths.length)throw Error('DEPLOY BLOQUEADO: manifesto contém caminho vazio ou duplicado')
 const functional=[...BANNER_RECOVERY_RELEASE.functionalPaths].sort()
 const gate=[...BANNER_RECOVERY_RELEASE.gatePaths].sort()
 const allowed=[...functional,...gate].sort()
 const unauthorized=actual.filter(file=>!allowed.includes(file))
 if(unauthorized.length)throw Error(`DEPLOY BLOQUEADO: ${blockedPathReason(unauthorized[0])}: ${unauthorized[0]}`)
 const missing=allowed.filter(file=>!actual.includes(file))
 if(missing.length)throw Error(`DEPLOY BLOQUEADO: manifesto incompleto: ${missing[0]}`)
 return {functional:[...BANNER_RECOVERY_RELEASE.functionalPaths],gate:[...BANNER_RECOVERY_RELEASE.gatePaths]}
}

export function validateBannerWorktreeStatus(porcelain){
 if(String(porcelain||'').trim())throw Error('DEPLOY BLOQUEADO: candidato Banner deve estar completamente limpo')
 return true
}

export function validateBannerAncestry({baseIsAncestor,functionalIsAncestor}){
 if(!baseIsAncestor||!functionalIsAncestor)throw Error('DEPLOY BLOQUEADO: ancestry do hotfix Banner inválida')
 return true
}

export function validateBannerVerifyJwt(configText){
 const source=String(configText||'')
 const match=source.match(/(?:^|\n)\[functions\.gerar-hero-ia\]\s*\n([\s\S]*?)(?=\n\[|$)/)
 if(!match||!/^\s*verify_jwt\s*=\s*false\s*$/m.test(match[1]))throw Error('DEPLOY BLOQUEADO: gerar-hero-ia deve preservar verify_jwt=false')
 return false
}

export function validateKnownBannerDesignFailure({status,output,testSource,bannerSource}){
 const text=String(output||'')
 const passing=/^(?:#|ℹ)\s*tests\s+6\b/m.test(text)&&/^(?:#|ℹ)\s*pass\s+6\b/m.test(text)&&/^(?:#|ℹ)\s*fail\s+0\b/m.test(text)
 if(status===0&&passing)return true
 const exactName='preserves Banner actions while migrating controls to ProductButton'
 const baselineTest=/disabled=\\\{!canGenerate\\\}/.test(String(testSource||''))
 const baselineBanner=String(bannerSource||'').includes('disabled={!canGenerate || (guestMode && guestConsumed)}')
 const oneFailure=/(?:#|ℹ)\s*tests\s+6\b/.test(text)&&/(?:#|ℹ)\s*pass\s+5\b/.test(text)&&/(?:#|ℹ)\s*fail\s+1\b/.test(text)
 if(status!==1||!text.includes(exactName)||!oneFailure||!baselineTest||!baselineBanner)throw Error('DEPLOY BLOQUEADO: falha de banner-design-system diverge do baseline aprovado')
 return true
}

export function validateBannerPromotionCandidate({url,info,detail,sha,current,fresh,backendVersion}){
 if(!/^https:\/\/smartcorretorai-[a-z0-9]+-smart-corretor-ai-s-projects\.vercel\.app$/.test(String(url||'')))throw Error('DEPLOY BLOQUEADO: BANNER_RECOVERY_CANDIDATE_URL inválida')
 if(info?.readyState!=='READY'||detail?.readyState!=='READY'||detail?.meta?.githubCommitSha!==sha)throw Error('DEPLOY BLOQUEADO: deployment Banner não corresponde ao checkpoint')
 if(current?.sha!==BANNER_RECOVERY_RELEASE.baseSha||current?.id!==BANNER_RECOVERY_RELEASE.frontendDeploymentId)throw Error('DEPLOY BLOQUEADO: baseline oficial do hotfix Banner mudou')
 if(fresh?.id!==current.id||fresh?.sha!==current.sha)throw Error('DEPLOY BLOQUEADO: Production mudou antes da promoção')
 if(!Number.isSafeInteger(backendVersion)||backendVersion<=BANNER_RECOVERY_RELEASE.edgeVersion)throw Error('DEPLOY BLOQUEADO: gerar-hero-ia ainda não avançou além da versão 74')
 return true
}
import {deploymentTarget} from './targets.mjs'
