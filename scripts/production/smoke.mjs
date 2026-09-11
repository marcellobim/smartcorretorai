import {readFileSync,existsSync} from 'node:fs'
import path from 'node:path'
export const products = [
 ['Vídeo Imobiliário','/smart-tour-ai','SmartTourAI','smart-tour-generate','createTour'],
 ['Banner Imobiliário','/hero','HeroNext','gerar-hero-ia','handleGenerate'],
 ['Smart Space','/virtual-staging','VirtualStaging','virtual-staging-image-test','createFurnishRenovateImage'],
 ['Banners Rápidos','/nova-campanha','NovaCampanha','gerar-banners','gerar'],
 ['Comercial Imobiliário','/studio-hero','StudioHero','criar-video-ia','handleGenerate'],
 ['Vídeo Criativo','/studio-hero','StudioHero','criar-video-ia','handleGenerate'],
 ['Smart Carrossel','/smart-carrossel','SmartCarrossel','smart-carousel-creatomate','createPresentation'],
 ['Campanha de Textos','/campanha-de-textos','TextCampaign','generate-text-campaign','generateCampaign'],
 ['Raio-X','/raio-x-anuncio','RaioXAnuncio','raio-x-anuncio','analyzeImages'],
]
export function smoke(root=process.cwd(),transform=(p,s)=>s){
 const read=p=>transform(p,readFileSync(path.join(root,p),'utf8'))
 const check=(ok,label)=>{if(!ok)throw Error('DEPLOY BLOQUEADO: smoke obrigatório falhou: '+label)}
 const app=read('frontend/src/App.jsx'),admin=read('frontend/src/pages/AdminDashboard.jsx'),hero=read('frontend/src/pages/HeroNext.jsx')
 check(read('frontend/src/components/landing/FirstCreationEntry.jsx').includes('Criar agora grátis'),'Landing CTA')
 check(app.includes('path="/criar-anuncio"') && read('frontend/src/pages/GuestBannerEntry.jsx').includes('guestMode'),'rota guest')
 check(hero.includes('currentQuestion.question') && !hero.includes('questionDrafts'),'chat humanizado')
 check(hero.includes('MAX_HERO_NEXT_IMAGES = 4') && hero.includes("index === 0 ? 'Principal'") && hero.includes('inline_images: uploadedImages.map'),'0–4 imagens/principal/payload')
 const home=read('frontend/src/pages/Dashboard.jsx')
 for(const group of ['video','imagem','texto','analisar'])check(home.includes(group),'Home '+group)
 for(const marker of ['Funil do cliente','Atividade recente','Último login','Última atividade','generation_completed','generation_failed'])check(admin.includes(marker),'Admin 2.0 '+marker)
 check(app.includes('AccountAnalyticsRoute'),'eventos de abertura')
 const rows=[]
 for(const [name,route,page,endpoint,action] of products){
  const file=`frontend/src/pages/${page}.jsx`;check(existsSync(path.join(root,file)),name+' componente')
  const code=read(file)
  check(app.includes(`path="${route}"`),name+' rota')
  check(/useState|useReducer|useGuidedConversation/.test(code),name+' início')
  check(/phase|step|question|conversation/i.test(code),name+' etapas')
  check(code.includes(endpoint),name+' backend')
  check(code.toLowerCase().includes(action.toLowerCase()) && /onClick=|onSubmit=|onGenerate=/.test(code),name+' ação final')
  check(code.includes('trackGenerationClicked()'),name+' evento Gerar')
  rows.push({product:name,route,component:file,start:'PASS',steps:'PASS',generation: endpoint,status:'PASS'})
 }
 return rows
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/smoke.mjs'))console.log(JSON.stringify(smoke(),null,2))
