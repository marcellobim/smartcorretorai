import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import path from 'node:path'
export const ancestryError='DEPLOY BLOQUEADO: o candidato não contém o estado atual de Production.'
export const hash=(data,algorithm='sha256')=>createHash(algorithm).update(data).digest('hex')
export function verifyProof(proof,official,root){
 const commits=new Map()
 for(const entry of proof.commits||[]){
  const body=Buffer.from(entry.body,'base64')
  if(hash(Buffer.concat([Buffer.from(`commit ${body.length}\0`),body]),'sha1')!==entry.sha)throw Error(ancestryError)
  commits.set(entry.sha,body.toString().split('\n').filter(l=>l.startsWith('parent ')).map(l=>l.slice(7)))
 }
 const queue=[proof.sha],seen=new Set();let found=false
 while(queue.length){const sha=queue.pop();if(seen.has(sha))continue;seen.add(sha);if(sha===official){found=true;break}queue.push(...(commits.get(sha)||[]))}
 if(!found||!commits.has(proof.sha))throw Error(ancestryError)
 if(root)for(const [file,digest] of Object.entries(proof.files||{})){
  if(file.includes('..')||path.isAbsolute(file)||hash(readFileSync(path.join(root,file)))!==digest)throw Error('DEPLOY BLOQUEADO: pacote difere do checkpoint: '+file)
 }
 return true
}
