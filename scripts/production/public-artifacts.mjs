import {readFileSync,readdirSync} from 'node:fs'
import path from 'node:path'
export function validatePublicText(text,environment={}) {
 const reject=reason=>{throw Error('DEPLOY BLOQUEADO: artefato público contém '+reason)}
 for(const [name,value] of Object.entries(environment)) {
  if(name.startsWith('VITE_')&&/SERVICE_ROLE|SECRET|PASSWORD|PRIVATE_KEY|ACCESS_TOKEN/i.test(name))reject('variável privada no namespace VITE')
  if(!name.startsWith('VITE_')&&/SERVICE_ROLE|SECRET|PASSWORD|PRIVATE_KEY|ACCESS_TOKEN/i.test(name)&&value?.length>=16&&text.includes(value))reject('valor privado do ambiente')
 }
 if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|sb_secret_[A-Za-z0-9_-]{20,}|(?:ghp_|github_pat_)[A-Za-z0-9_]{20,}|sk_live_[A-Za-z0-9]{16,}/.test(text))reject('padrão de credencial privada')
 for(const token of text.matchAll(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)) {
  try {if(JSON.parse(Buffer.from(token[0].split('.')[1],'base64url')).role==='service_role')reject('JWT service_role')}catch(error){if(error.message.startsWith('DEPLOY BLOQUEADO'))throw error}
 }
 if(/lymiddkmeyikgtyxpyup|admin-pr1-(?:admin|common)-20260915@example\.test|1x00000000000000000000AA/.test(text))reject('configuração ou fixture de staging')
}
export function verifyPublicArtifacts(root=process.cwd(),environment=process.env) {
 let count=0
 const walk=directory=>{for(const entry of readdirSync(directory,{withFileTypes:true})){
  const file=path.join(directory,entry.name)
  if(entry.isDirectory())walk(file)
  else if(/\.(js|css|html|json|map|txt|svg)$/i.test(file)){validatePublicText(readFileSync(file,'utf8'),environment);count++}
 }}
 walk(path.join(root,'frontend/dist'))
 if(!count)throw Error('DEPLOY BLOQUEADO: nenhum artefato público verificado')
 console.log(JSON.stringify({publicArtifacts:'PASS',textFiles:count,stagingExcluded:true}))
}
