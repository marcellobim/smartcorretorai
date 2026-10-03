import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const read=file=>readFileSync(path.join(root,file),'utf8')
const terms=read('src/pages/TermosDeUso.jsx')
const privacy=read('src/pages/Privacidade.jsx')
const landing=read('src/pages/LandingPage.jsx')
const legalOnboarding=read('src/pages/LegalOnboardingPage.jsx')
const registerPt=read('src/i18n/messages/pt-BR.js')
const registerEn=read('src/i18n/messages/en-US.js')

test('legal pages use SNETIA, current contact and October 2026',()=>{
 for(const source of [terms,privacy]){
  assert.match(source,/BRAND\.name/)
  assert.match(source,/Outubro de 2026/)
  assert.match(source,/BRAND\.supportEmail/)
  assert.doesNotMatch(source,/SmartCorretorAI|smartcorretorai\.com|suporte@smartcorretorai\.com/)
 }
})

test('legal copy describes current operation without promising future social publishing',()=>{
 assert.match(terms,/Brasil e nos Estados Unidos/)
 assert.match(terms,/Instagram e Facebook/)
 assert.match(terms,/TikTok somente poderá ser oferecido quando a integração estiver efetivamente disponível/)
 assert.match(terms,/Stripe é o provedor de pagamento atualmente utilizado/)
 assert.doesNotMatch(terms,/Shopify|\bPix\b/)
 assert.match(privacy,/LGPD/)
 assert.match(privacy,/Supabase, Vercel, Stripe, Resend, OpenAI, Google\/Gemini, Creatomate e Meta/)
 assert.match(privacy,/Supabase Auth ou, quando aplicável, Resend/)
 assert.match(privacy,/não é destinada a crianças/)
})

test('public registration and landing copy do not promise a token amount or card requirement',()=>{
 for(const source of [landing,registerPt,registerEn]){
  assert.doesNotMatch(source,/200 Smart Tokens/i)
  assert.doesNotMatch(source,/sem cartão|no card required/i)
 }
 assert.match(registerPt,/Crie sua conta e comece a explorar a SNETIA/)
 assert.match(registerEn,/Create your account and start exploring SNETIA/)
})

test('public landing and legal acceptance keep the current brand without extra consent',()=>{
 assert.doesNotMatch(landing,/SmartCorretorAI|smartcorretorai\.com|suporte@smartcorretorai\.com/)
 assert.match(landing,/#SNETIA/)
 assert.match(legalOnboarding,/BRAND\.name/)
 assert.match(legalOnboarding,/Termos de Uso/)
 assert.match(legalOnboarding,/Política de Privacidade/)
 assert.doesNotMatch(legalOnboarding,/marketing|newsletter|comunicaç(?:ão|oes) promocional/i)
})
