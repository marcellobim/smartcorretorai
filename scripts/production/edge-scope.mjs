export function edgeScope(args) {
 if(args.some(arg=>!['--video-social-metadata','--admin-api'].includes(arg)))throw Error('DEPLOY BLOQUEADO: opção desconhecida')
 if(args.includes('--video-social-metadata')&&args.includes('--admin-api'))throw Error('DEPLOY BLOQUEADO: selecione apenas um escopo de Edge Functions')
 return args.includes('--admin-api')?['admin-api']:args.includes('--video-social-metadata')?['smart-tour-generate','social-publish-video']:[]
}
export function adminApiVersion(functions) {
 const admin=functions.find(f=>f.slug==='admin-api')
 if(!admin||admin.verify_jwt!==true||admin.status!=='ACTIVE'||!Number.isSafeInteger(admin.version))throw Error('DEPLOY BLOQUEADO: admin-api deve estar ativa com JWT habilitado')
 return admin.version
}
