import {useEffect,useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {useAuthStore} from '../../lib/auth-context'
import {guestBannerRequest,guestResultForBanner,GUEST_CLAIM_PENDING} from '../../lib/guest-banner-client'

export default function GuestClaimResume(){
 const {user,loading,onboardingState}=useAuthStore()
 const [retry,setRetry]=useState(0)
 const [failed,setFailed]=useState(false)
 const navigate=useNavigate()
 useEffect(()=>{
   if(loading || !user || ['checking','needs_acceptance','error','admin_blocked'].includes(onboardingState))return
   if(localStorage.getItem(GUEST_CLAIM_PENDING)!=='1')return
   let active=true
   guestBannerRequest('claim').then(result=>{
     if(!active || !result.claimed)return
     sessionStorage.setItem('smartcorretorai:hero-ia-next:last-result',JSON.stringify(guestResultForBanner(result)))
     localStorage.removeItem(GUEST_CLAIM_PENDING)
     navigate('/hero',{replace:true})
   }).catch(()=>{if(active)setFailed(true)})
   return()=>{active=false}
 },[user?.id,loading,onboardingState,retry,navigate])
 if(!failed)return null
 return <aside role="alert" className="fixed bottom-4 right-4 z-[150] max-w-sm rounded-xl bg-white p-4 shadow-xl">
   <p>Seu anúncio continua salvo. Não foi possível recuperá-lo agora.</p>
   <button type="button" onClick={()=>{setFailed(false);setRetry(n=>n+1)}} className="mt-2 font-bold underline">Recuperar anúncio</button>
 </aside>
}
