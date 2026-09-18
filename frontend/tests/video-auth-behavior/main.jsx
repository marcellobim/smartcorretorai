import React from 'react'
import {createRoot} from 'react-dom/client'
import {BrowserRouter} from 'react-router-dom'
import SmartTourAI from '../../src/pages/SmartTourAI'
import {writeProductDraft} from '../../src/lib/product-draft'
import {owner} from './mocks'
import '../../src/index.css'
const requestId='33333333-3333-4333-8333-333333333333'
if(!new URLSearchParams(location.search).has('restore')){
 sessionStorage.removeItem('smartcorretorai:smart-tour:active-job')
 writeProductDraft(sessionStorage,{productKey:'video-imobiliario',schemaVersion:1,userId:owner,data:{activeInputFlow:'images',property:{purpose:'sale',type:'apartment',city:'Cidade sintética',state:'SP',district:'Bairro teste',bedrooms:'2',suites:'1',parkingSpaces:'1',area:'100',highlights:[]},generation:{presenterGender:'female',presenterSpeechMode:'custom',presenterCustomSpeech:'Conheça este imóvel de teste.',narration:'enabled',captions:'disabled'},ctaEnabled:false,cta:'',includePhone:false,conversation:{activeQuestionId:'review',history:[]},imageMetadata:Array.from({length:5},(_,order)=>({name:`foto${order+1}.jpg`,size:100,type:'image/jpeg',lastModified:0,order})),uploads:{requestId,savedAt:Date.now(),paths:Array.from({length:5},(_,i)=>`${owner}/smart-tour/${requestId}/0${i+1}.jpg`)},resumeAfterLogin:true}})
}
createRoot(document.getElementById('root')).render(<BrowserRouter><aside style={{position:'fixed',top:0,right:0,zIndex:9999,background:'white',border:'2px solid black',padding:8}}>TESTE LOCAL — sem provider<pre id="calls">{JSON.stringify({auth:0,uploads:0,lists:0,generation:0,status:0})}</pre><a href="?mode=valid&restore=1">Simular retorno após login</a></aside><SmartTourAI/></BrowserRouter>)
