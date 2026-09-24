import { MAX_BYTES, fail } from '../_shared/tiktok-posting/contract.mjs'

// This adapter consumes only a resolved, owner-checked creation from the server.
export function storageAdapters({admin,supabaseUrl,serviceKey,fetcher}) {
 const base = new URL(supabaseUrl)
 if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) fail('posting_configuration_invalid')
 return {
  async inspectObject({bucket,objectPath}) {
   const split = objectPath.lastIndexOf('/')
   const name = objectPath.slice(split+1)
   const {data,error} = await admin.storage.from(bucket).list(objectPath.slice(0,split),{limit:2,search:name})
   const object = data?.find(row => row.name === name)
   if (error || !object) fail('posting_media_invalid')
   return {size:Number(object.metadata?.size),contentType:object.metadata?.mimetype,
    etag:object.metadata?.eTag ?? object.metadata?.etag ?? null,version:object.version ?? null}
  },
  async loadBytes(creation) {
   const url = new URL('/storage/v1/object/authenticated/' + creation.bucket + '/' +
    creation.objectPath.split('/').map(encodeURIComponent).join('/'),base)
   const response = await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(20000),
    headers:{Authorization:'Bearer '+serviceKey,apikey:serviceKey}})
   const expected = creation.media.size
   const length = response.headers.get('content-length')
   if (!response.ok || response.headers.get('content-type')?.split(';')[0] !== 'video/mp4' ||
       length !== null && Number(length) !== expected || !response.body ||
       !Number.isSafeInteger(expected) || expected <= 0 || expected > MAX_BYTES) {
    await response.body?.cancel(); fail('posting_media_invalid')
   }
   const bytes = new Uint8Array(expected),reader = response.body.getReader()
   let offset = 0
   try {
    while (true) {
     const {value,done} = await reader.read()
     if (done) break
     if (offset+value.byteLength > expected) fail('posting_media_changed')
     bytes.set(value,offset); offset += value.byteLength
    }
   } finally { await reader.cancel().catch(() => {}) }
   if (offset !== expected) fail('posting_media_changed')
   return bytes
  },
  async preview(creation) {
   const {data,error} = await admin.storage.from(creation.bucket).createSignedUrl(creation.objectPath,300)
   if (error || !data?.signedUrl) fail('posting_media_invalid')
   const url = new URL(data.signedUrl)
   const prefix = '/storage/v1/object/sign/' + creation.bucket + '/'
   if (url.origin !== base.origin || !url.pathname.startsWith(prefix)) fail('posting_media_invalid')
   return url.toString()
  },
 }
}
