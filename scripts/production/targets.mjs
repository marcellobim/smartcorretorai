const teamId='team_Jhfx1Tk09PX2qGSgri0sSvsQ'

export const productionTargets=Object.freeze({
 smartcorretorai:Object.freeze({
  name:'smartcorretorai',projectId:'prj_U3MEwzheOk76LJzPIdx3OyLQbs5g',teamId,
  branch:'master',alias:'www.smartcorretorai.com',domain:'smartcorretorai.com',
  buildCommand:'node scripts/production/build.mjs',outputDirectory:'frontend/dist',
  smokeRoutes:Object.freeze(['/','/criar-anuncio','/dashboard','/admin']),brand:'SmartCorretorAI',
 }),
 snetia:Object.freeze({
  name:'snetia',projectId:'prj_NdHb7sL026aEo0Qn9cvkM9MNLOlA',teamId,
  branch:'codex/snetia-migration',alias:'snetia.com',domain:'snetia.com',
  buildCommand:'npm --prefix frontend run build',outputDirectory:'frontend/dist',
  smokeRoutes:Object.freeze(['/','/login','/cadastro','/auth/callback','/redefinir-senha','/planos']),brand:'SNETIA',
 }),
})

export function deploymentTarget(args=[]){
 const indexes=args.map((value,index)=>value==='--target'?index:-1).filter(index=>index>=0)
 if(indexes.length!==1||indexes[0]===args.length-1)throw Error('DEPLOY BLOQUEADO: informe exatamente um --target válido')
 const name=args[indexes[0]+1]
 if(!Object.hasOwn(productionTargets,name))throw Error('DEPLOY BLOQUEADO: target desconhecido: '+String(name))
 return productionTargets[name]
}

export function deploymentOptions(args=[]){
 const count=args.filter(value=>value==='--candidate-only').length
 if(count>1)throw Error('DEPLOY BLOQUEADO: --candidate-only foi informado mais de uma vez')
 return {candidateOnly:count===1,dryRun:args.includes('--dry-run')}
}

export function dryRunPlan(target,sha,{candidateOnly=false}={}){
 return {dryRun:true,candidateOnly,target:target.name,projectId:target.projectId,teamId:target.teamId,branch:target.branch,sha,alias:target.alias,domain:target.domain,buildCommand:target.buildCommand,outputDirectory:target.outputDirectory,smokeRoutes:target.smokeRoutes,productionAliasInspect:candidateOnly?'skipped by --candidate-only':'required',rollbackBaseline:candidateOnly?'skipped by --candidate-only':'required',candidateSmoke:'vercel.app',promotion:candidateOnly?'skipped by --candidate-only':'enabled'}
}

export function assertTargetIdentity(target,detail){
 if(detail?.projectId!==target.projectId||detail?.ownerId!==target.teamId||detail?.name!==target.name)throw Error('DEPLOY BLOQUEADO: identidade Vercel divergente do target '+target.name)
 return true
}
