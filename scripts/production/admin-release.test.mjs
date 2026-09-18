import test from 'node:test'
import assert from 'node:assert/strict'
import {edgeScope,adminApiVersion} from './edge-scope.mjs'
import {validatePublicText} from './public-artifacts.mjs'
test('admin release targets only admin-api and rejects combined/unrecognized scopes',()=>{
 assert.deepEqual(edgeScope(['--admin-api']),['admin-api'])
 assert.deepEqual(edgeScope([]),[])
 assert.deepEqual(edgeScope(['--video-social-metadata']),['smart-tour-generate','social-publish-video'])
 assert.throws(()=>edgeScope(['--admin-api','--video-social-metadata']))
 assert.throws(()=>edgeScope(['--anything']))
})
test('admin release refuses absent/inactive function or disabled JWT',()=>{
 const active={slug:'admin-api',version:25,status:'ACTIVE',verify_jwt:true}
 assert.equal(adminApiVersion([active]),25)
 for(const functions of [[],[{...active,verify_jwt:false}],[{...active,status:'REMOVED'}],[{...active,version:undefined}]])assert.throws(()=>adminApiVersion(functions))
})
test('public artifact gate allows public configuration but rejects private and staging values',()=>{
 const jwt=role=>'eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({role})).toString('base64url')+'.fixture_signature'
 assert.doesNotThrow(()=>validatePublicText(jwt('anon'),{VITE_SUPABASE_ANON_KEY:jwt('anon')}))
 assert.throws(()=>validatePublicText(jwt('service_role')))
 assert.throws(()=>validatePublicText('lymiddkmeyikgtyxpyup'))
 assert.throws(()=>validatePublicText('1x00000000000000000000AA'))
 assert.throws(()=>validatePublicText('fixture-private-value',{SUPABASE_SERVICE_ROLE_KEY:'fixture-private-value'}))
 assert.throws(()=>validatePublicText('safe',{VITE_PRIVATE_KEY:'fixture'}))
 assert.throws(()=>validatePublicText('-----BEGIN PRIVATE KEY-----'))
})

import {mkdtempSync,writeFileSync,rmSync} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {verifyArchiveTree} from './archive-proof.mjs'
test('archive gate rejects missing or modified Git files before upload',()=>{
 const dir=mkdtempSync(path.join(os.tmpdir(),'admin-archive-test-'))
 try {
  const tree='100644 blob ce013625030ba8dba906f756967f9e9ca394464a\thello.txt\0'
  assert.throws(()=>verifyArchiveTree(tree,dir))
  writeFileSync(path.join(dir,'hello.txt'),'hello\n')
  assert.equal(verifyArchiveTree(tree,dir),1)
  writeFileSync(path.join(dir,'hello.txt'),'changed\n')
  assert.throws(()=>verifyArchiveTree(tree,dir))
  assert.throws(()=>verifyArchiveTree('',dir))
  assert.throws(()=>verifyArchiveTree(tree.replace('hello.txt','../outside.txt'),dir))
 } finally {rmSync(dir,{recursive:true,force:true})}
})
