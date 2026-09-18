import {createServer} from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
const root=fileURLToPath(new URL('../',import.meta.url))
process.chdir(root)
const mock=path.join(root,'tests/video-auth-behavior/mocks.js')
const server=await createServer({root,configFile:false,optimizeDeps:{entries:['tests/video-auth-behavior/index.html']},plugins:[{name:'video-auth-test-mocks',enforce:'pre',resolveId(source){if(['/supabase','/supabase.js','/auth-context','/auth-context.jsx','/useAccountAnalytics'].some(s=>source.endsWith(s)))return mock}},react()],server:{host:'127.0.0.1',port:4188,strictPort:true,fs:{allow:[path.resolve(root,'..')]}}})
await server.listen();console.log('Synthetic auth harness: http://127.0.0.1:4188/tests/video-auth-behavior/?mode=invalid')
