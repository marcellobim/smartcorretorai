import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

let vite
let CampaignPackage
let BannerPublishDialog
const frontendRoot = fileURLToPath(new URL('..', import.meta.url))
before(async()=>{vite=await createServer({root:frontendRoot,server:{middlewareMode:true},appType:'custom'});({CampaignPackage}=await vite.ssrLoadModule('/src/components/campaign/CampaignPackage.jsx'));({default:BannerPublishDialog}=await vite.ssrLoadModule('/src/components/campaign/BannerPublishDialog.jsx'))})
after(async()=>vite?.close())

const jobId='6b66b517-8fea-4b62-a180-89f64c418cba'
const data={sourceProduct:'SmartCorretorAI',sourceType:'video_imobiliario',sourceId:jobId,mediaAssetId:jobId,mediaType:'video',previewUrl:'https://private.invalid/video.mp4',downloadUrl:'https://private.invalid/video.mp4',unifiedSocialPublishing:true,aiCampaigns:[1,2,3].map(number=>({id:`smart-tour-caption-option-${number}`,name:`Opção ${number}`,instagram:`Texto exato ${number}`,facebook:`Texto exato ${number}`,whatsapp:`Texto exato ${number}`,linkedin:`Texto exato ${number}`}))}

test('Vídeo Imobiliário renderiza três ações Copiar | Publicar sem escolhas técnicas',()=>{const markup=renderToStaticMarkup(createElement(CampaignPackage,{data,videoPublish:{enabled:true}}));assert.equal((markup.match(/>Publicar<\/button>/g)||[]).length,3);assert.ok((markup.match(/aria-label="Copiar"/g)||[]).length>=3);assert.doesNotMatch(markup,/\bFeed\b|\bReel\b|\bStory\b|container|lease/i)})
test('modal de vídeo mostra a mídia, legenda e destinos simples sem publicar',()=>{const markup=renderToStaticMarkup(createElement(BannerPublishDialog,{intent:{mediaType:'video',mediaPreviewUrl:'https://private.invalid/video.mp4',mediaName:'Vídeo Imobiliário',optionLabel:'Texto 2',captionSnapshot:'Texto exato 2'},loadConnection:async()=>({connected:true,status:'active',username:'smartcorretorai',pageName:'SmartCorretorAI'})}));assert.match(markup,/<video/);assert.match(markup,/Texto exato 2/);assert.match(markup,/Publicar agora/);assert.match(markup,/Cancelar/);assert.doesNotMatch(markup,/\bFeed\b|\bReel\b|\bStory\b|container|lease/i)})
