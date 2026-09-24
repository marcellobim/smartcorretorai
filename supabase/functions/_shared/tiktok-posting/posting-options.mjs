import {validateOptions} from './contract.mjs'
export const PRIVACY = Object.freeze(['PUBLIC_TO_EVERYONE','MUTUAL_FOLLOW_FRIENDS','FOLLOWER_OF_CREATOR','SELF_ONLY'])
export const check = (ok,code='invalid_options') => { if(!ok) throw new Error(code) }
const object = v => !!v && typeof v==='object' && !Array.isArray(v)
const text = (v,n) => typeof v==='string' && v.trim().length>0 && v.length<=n && !/[\x00-\x1f\x7f]/.test(v)
export function parseCreatorInfo(data){
 check(object(data),'invalid_creator_info')
 const {creator_avatar_url,creator_username,creator_nickname,privacy_level_options,max_video_post_duration_sec}=data
 check(text(creator_avatar_url,4096)&&text(creator_username,256)&&text(creator_nickname,256),'invalid_creator_info')
 let url;try{url=new URL(creator_avatar_url)}catch{check(false,'invalid_creator_info')}
 check(url.protocol==='https:'&&!url.username&&!url.password&&!url.hash,'invalid_creator_info')
 check(Array.isArray(privacy_level_options)&&privacy_level_options.length<=4 &&
   privacy_level_options.every(v=>PRIVACY.includes(v))&&new Set(privacy_level_options).size===privacy_level_options.length,'invalid_creator_info')
 check(privacy_level_options.length>0,'creator_restriction')
 for(const k of ['comment_disabled','duet_disabled','stitch_disabled'])check(typeof data[k]==='boolean','invalid_creator_info')
 check(Number.isSafeInteger(max_video_post_duration_sec)&&max_video_post_duration_sec>0,'invalid_creator_info')
 return {creator_avatar_url,creator_username,creator_nickname,privacy_level_options:[...privacy_level_options],
  comment_disabled:data.comment_disabled,duet_disabled:data.duet_disabled,stitch_disabled:data.stitch_disabled,max_video_post_duration_sec}
}
export function creatorSnapshot(info){
 const c=parseCreatorInfo(info)
 return Object.fromEntries(['privacy_level_options','comment_disabled','duet_disabled','stitch_disabled','max_video_post_duration_sec'].map(k=>[k,c[k]]))
}
export function initialPostingSelection(info){
 const creator=parseCreatorInfo(info)
 return {privacy_level:null,allow_comment:false,allow_duet:false,allow_stitch:false,
  commercial_disclosure:false,brand_content_toggle:false,brand_organic_toggle:false,
  disabled:{comment:creator.comment_disabled,duet:creator.duet_disabled,stitch:creator.stitch_disabled}}
}
export function confirmedPostInfo({creator,probe,options,consent}){
 const snapshot=creatorSnapshot(creator)
 check(probe?.container==='mp4'&&probe.parse_valid===true&&probe.integrity==='structural_sample_bounds'&&
 ['h264','hevc'].includes(probe.codec)&&
 [probe.width,probe.height].every(n=>Number.isSafeInteger(n)&&n>=360&&n<=4096)&&
 Number.isFinite(probe.fps)&&probe.fps>=23&&probe.fps<=60&&
 Number.isSafeInteger(probe.duration_ms)&&probe.duration_ms>0&&probe.duration_ms<=600000&&
 Number.isSafeInteger(probe.content_length)&&probe.content_length>0&&probe.content_length<=52428800&&
 /^[a-f0-9]{64}$/.test(probe.content_sha256),'invalid_media')
 check(probe.duration_ms<=snapshot.max_video_post_duration_sec*1000,'invalid_media')
 const keys=['confirmed','commercial_disclosure','music_usage_confirmed','branded_content_policy_confirmed']
 check(object(consent)&&Object.keys(consent).length===keys.length&&keys.every(k=>typeof consent[k]==='boolean')&&consent.confirmed&&consent.music_usage_confirmed)
 check(object(options))
 check(consent.commercial_disclosure===(options.brand_content_toggle===true||options.brand_organic_toggle===true))
 check(!options.brand_content_toggle||consent.branded_content_policy_confirmed)
 check(!options.brand_content_toggle||['PUBLIC_TO_EVERYONE','MUTUAL_FOLLOW_FRIENDS'].includes(options.privacy_level))
 // AIGC comes from the fixed Commercial Imobiliario contract, never filename inference.
 check(options.is_aigc===true)
 try{return validateOptions(options,snapshot,probe.duration_ms)}catch{check(false)}
}
