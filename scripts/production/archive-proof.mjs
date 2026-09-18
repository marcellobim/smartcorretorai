import {readFileSync,lstatSync} from 'node:fs'
import path from 'node:path'
import {hash} from './proof.mjs'
export function verifyArchiveTree(tree,root) {
 const entries=tree.split('\0').filter(Boolean)
 if(!entries.length)throw Error('DEPLOY BLOQUEADO: árvore Git vazia')
 const base=path.resolve(root)+path.sep
 for(const entry of entries){
  const match=entry.match(/^(\d+) blob ([a-f0-9]{40})\t([\s\S]+)$/)
  if(!match)throw Error('DEPLOY BLOQUEADO: entrada Git inválida')
  const [,mode,expected,file]=match,target=path.resolve(root,file)
  if(!target.startsWith(base)||!['100644','100755'].includes(mode))throw Error('DEPLOY BLOQUEADO: caminho/tipo de arquivo não suportado')
  if(!lstatSync(target).isFile())throw Error('DEPLOY BLOQUEADO: arquivo ausente no pacote: '+file)
  const data=readFileSync(target),actual=hash(Buffer.concat([Buffer.from(`blob ${data.length}\0`),data]),'sha1')
  if(actual!==expected)throw Error('DEPLOY BLOQUEADO: arquivo difere do Git: '+file)
 }
 return entries.length
}
