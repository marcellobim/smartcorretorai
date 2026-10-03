import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','..')
const rules=readFileSync(path.join(root,'.vercelignore'),'utf8').split(/\r?\n/).filter(Boolean)
const virtualStaging='supabase/functions/_shared/virtual-staging'
const presentation=`${virtualStaging}/presentation.ts`
const smartTour='supabase/functions/_shared/smart-tour'
const smartTourRuntime=[`${smartTour}/publication-options.ts`,`${smartTour}/presentation.ts`]

const matches=(pattern,candidate)=>new RegExp(`^${pattern.replace(/[|\\{}()[\]^$+?.]/g,'\\$&').replaceAll('*','[^/]*')}$`).test(candidate)
const ignored=candidate=>rules.reduce((state,rule)=>{
 const negated=rule.startsWith('!'),pattern=negated?rule.slice(1):rule
 return matches(pattern,candidate)?!negated:state
},false)

test('Vercel upload re-includes only the virtual staging presentation source',()=>{
 assert.equal(ignored(virtualStaging),false)
 assert.equal(ignored(presentation),false)
 assert.equal(ignored(`${virtualStaging}/types.ts`),true)
 assert.equal(ignored(`${virtualStaging}/index.ts`),true)
 assert.deepEqual(rules.slice(rules.indexOf(`!${virtualStaging}`),rules.indexOf(`!${virtualStaging}`)+3),[
  `!${virtualStaging}`,
  `${virtualStaging}/*`,
  `!${presentation}`,
 ])
})

test('Vercel upload includes only the Smart Tour frontend runtime closure',()=>{
 for(const file of smartTourRuntime)assert.equal(ignored(file),false,file)
 assert.equal(ignored(`${smartTour}/types.ts`),true)
 assert.equal(ignored(`${smartTour}/index.ts`),true)
 assert.equal(ignored(`${smartTour}/build-prompt.ts`),true)
})
