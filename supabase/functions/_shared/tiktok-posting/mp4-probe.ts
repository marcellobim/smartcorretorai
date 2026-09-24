/**
 * Structural probe only: does not decode frames or certify visual quality.
 * Backend must authorize the object before calling and retain exclusive ownership
 * of these bytes through the hash call. No URLs, storage access or provider calls.
 */
export const MP4_MAX_BYTES = 50 * 1024 * 1024
type Box = { type: string; start: number; end: number }
export type Mp4Metadata = {
  container: 'mp4'; codec: 'h264' | 'hevc'; width: number; height: number
  duration_ms: number; fps: number; content_length: number
  parse_valid: true; integrity: 'structural_sample_bounds'
}
function requireValue(ok: unknown, code: string): asserts ok {
  if (!ok) throw new Error('mp4_probe_' + code)
}
export function parseMp4Structure(bytes: Uint8Array, creatorMaxSeconds?: number): Mp4Metadata {
  requireValue(bytes instanceof Uint8Array && bytes.buffer instanceof ArrayBuffer, 'bytes_required')
  requireValue(!(bytes.buffer as ArrayBuffer & { resizable?: boolean }).resizable, 'resizable_buffer')
  const size = bytes.byteLength
  requireValue(size > 0 && size <= MP4_MAX_BYTES, 'size')
  const maxDuration = creatorMaxSeconds === undefined ? 600 : Math.min(600, creatorMaxSeconds)
  requireValue(Number.isFinite(maxDuration) && maxDuration > 0, 'duration_limit')
  const view = new DataView(bytes.buffer, bytes.byteOffset, size)
  const bound = (p: number, n: number, end = size) => requireValue(
    Number.isSafeInteger(p) && Number.isSafeInteger(n) && p >= 0 && n >= 0 && p + n <= end, 'bounds')
  const u8 = (p: number) => { bound(p, 1); return view.getUint8(p) }
  const u16 = (p: number) => { bound(p, 2); return view.getUint16(p) }
  const u32 = (p: number) => { bound(p, 4); return view.getUint32(p) }
  const u64 = (p: number) => {
    bound(p, 8); const n = Number(view.getBigUint64(p))
    requireValue(Number.isSafeInteger(n), 'integer_overflow'); return n
  }
  const tag = (p: number) => {
    bound(p, 4); return String.fromCharCode(bytes[p], bytes[p+1], bytes[p+2], bytes[p+3])
  }
  let boxBudget = 10000
  const boxes = (start: number, end: number): Box[] => {
    const result: Box[] = []
    for (let p = start; p < end;) {
      requireValue(--boxBudget >= 0, 'box_budget')
      bound(p, 8, end)
      let length = u32(p), header = 8
      if (length === 1) { bound(p, 16, end); length = u64(p+8); header = 16 }
      if (length === 0) length = end-p
      requireValue(length >= header && length <= end-p, 'box_bounds')
      result.push({ type: tag(p+4), start: p+header, end: p+length })
      p += length
    }
    return result
  }
  const one = (list: Box[], type: string) => {
    const matches = list.filter(b => b.type === type)
    requireValue(matches.length === 1, 'missing_or_duplicate_' + type)
    return matches[0]
  }
  const children = (b: Box) => boxes(b.start, b.end)
  const table = (b: Box, width: number) => {
    bound(b.start, 8, b.end)
    requireValue(u32(b.start) === 0, 'table_version')
    const n = u32(b.start+4)
    requireValue(n > 0 && n <= 2_000_000 && b.start+8+n*width === b.end, 'table_length')
    return { count: n, start: b.start+8 }
  }
  const top = boxes(0, size)
  requireValue(!top.some(b => b.type === 'moof'), 'fragmented_unsupported')
  const ftyp = one(top, 'ftyp')
  requireValue(ftyp.end-ftyp.start >= 8 && (ftyp.end-ftyp.start)%4 === 0, 'ftyp')
  const brands = [tag(ftyp.start)]
  for (let p = ftyp.start+8; p < ftyp.end; p += 4) brands.push(tag(p))
  requireValue(brands.some(b => ['isom','iso2','iso4','iso5','iso6','mp41','mp42','avc1','hvc1','hev1'].includes(b)), 'container')
  const mdats = top.filter(b => b.type === 'mdat')
  requireValue(mdats.length > 0, 'missing_mdat')
  const movie = children(one(top, 'moov'))
  requireValue(!movie.some(b => b.type === 'mvex'), 'fragmented_unsupported')
  const tracks: Mp4Metadata[] = []
  for (const track of movie.filter(b => b.type === 'trak')) {
    const trackChildren = children(track)
    const media = children(one(trackChildren, 'mdia'))
    const handler = one(media, 'hdlr'); bound(handler.start, 12, handler.end)
    if (tag(handler.start+8) !== 'vide') continue
    const mdhd = one(media, 'mdhd')
    bound(mdhd.start, 4, mdhd.end)
    const version = u8(mdhd.start)
    requireValue(version === 0 || version === 1, 'mdhd_version')
    bound(mdhd.start, version === 0 ? 24 : 36, mdhd.end)
    const timescale = u32(mdhd.start + (version === 0 ? 12 : 20))
    const declaredTicks = version === 0 ? u32(mdhd.start+16) : u64(mdhd.start+24)
    requireValue(timescale > 0, 'timescale')
    const minf = children(one(media, 'minf'))
    const dinf = children(one(minf, 'dinf'))
    const dref = one(dinf, 'dref'); bound(dref.start, 8, dref.end)
    requireValue(u32(dref.start) === 0 && u32(dref.start+4) === 1, 'data_reference')
    const references = boxes(dref.start+8, dref.end)
    requireValue(references.length === 1 && references[0].type === 'url ' &&
      references[0].end-references[0].start === 4 && u32(references[0].start) === 1, 'external_reference')
    const stbl = children(one(minf, 'stbl'))
    requireValue(!stbl.some(b => ['senc','saiz','saio','stz2'].includes(b.type)), 'unsupported_structure')
    const stsd = one(stbl, 'stsd'); bound(stsd.start, 8, stsd.end)
    requireValue(u32(stsd.start) === 0 && u32(stsd.start+4) === 1, 'sample_descriptions')
    const entries = boxes(stsd.start+8, stsd.end)
    requireValue(entries.length === 1, 'sample_descriptions')
    const entry = entries[0]
    requireValue(['avc1','avc3','hvc1','hev1'].includes(entry.type), 'codec')
    bound(entry.start, 78, entry.end)
    requireValue(u16(entry.start+6) === 1, 'data_reference')
    const width = u16(entry.start+24), height = u16(entry.start+26)
    requireValue(width >= 360 && width <= 4096 && height >= 360 && height <= 4096, 'resolution')
    const codec = entry.type.startsWith('avc') ? 'h264' : 'hevc'
    const config = one(boxes(entry.start+78, entry.end), codec === 'h264' ? 'avcC' : 'hvcC')
    bound(config.start, codec === 'h264' ? 7 : 23, config.end)
    requireValue(u8(config.start) === 1, 'codec_config')
    // Parameter-set records must fit their declared box. No bitstream decoding.
    if (codec === 'h264') {
      requireValue((u8(config.start+4)&3) !== 2, 'codec_config')
      let p = config.start+6
      const sps = u8(config.start+5)&31
      requireValue(sps > 0, 'codec_config')
      const nal = () => { bound(p,2,config.end); const n=u16(p); p+=2; requireValue(n>0,'codec_config'); bound(p,n,config.end); p+=n }
      for (let i=0;i<sps;i++) nal()
      bound(p,1,config.end); const pps=u8(p++); requireValue(pps>0,'codec_config')
      for (let i=0;i<pps;i++) nal()
      // AVC high-profile extension is allowed; sample/box bounds still enforced.
    } else {
      requireValue((u8(config.start+21)&3) !== 2, 'codec_config')
      let p=config.start+23; const arrays=u8(config.start+22); let sets=0
      requireValue(arrays>0,'codec_config')
      for(let i=0;i<arrays;i++){
        bound(p,3,config.end); p++; const count=u16(p);p+=2
        for(let j=0;j<count;j++){bound(p,2,config.end);const n=u16(p);p+=2;requireValue(n>0,'codec_config');bound(p,n,config.end);p+=n;sets++}
      }
      requireValue(sets>0 && p===config.end,'codec_config')
    }
    const timing = table(one(stbl, 'stts'), 8)
    let sampleCount=0, ticks=0, largestDelta=0
    for(let i=0;i<timing.count;i++){
      const p=timing.start+i*8,n=u32(p),delta=u32(p+4)
      requireValue(n>0 && delta>0,'timing')
      sampleCount+=n;ticks+=n*delta;largestDelta=Math.max(largestDelta,delta)
      requireValue(sampleCount<=2_000_000 && Number.isSafeInteger(ticks),'timing_budget')
    }
    requireValue(Math.abs(declaredTicks-ticks)<=largestDelta,'duration_inconsistent')
    const duration=ticks/timescale, fps=sampleCount/duration
    requireValue(duration>0 && duration<=maxDuration,'duration')
    requireValue(Number.isFinite(fps) && fps>=23 && fps<=60,'fps')
    const sizes=one(stbl,'stsz');bound(sizes.start,12,sizes.end)
    requireValue(u32(sizes.start)===0,'table_version')
    const fixed=u32(sizes.start+4),count=u32(sizes.start+8)
    requireValue(count===sampleCount && sizes.start+12+(fixed?0:count*4)===sizes.end,'sample_sizes')
    const offsetBoxes=stbl.filter(b=>b.type==='stco'||b.type==='co64')
    requireValue(offsetBoxes.length===1,'offsets')
    const offsetBox=offsetBoxes[0],offsetWidth=offsetBox.type==='stco'?4:8
    const offsets=table(offsetBox,offsetWidth),mapping=table(one(stbl,'stsc'),12)
    let lastFirst=0
    for(let i=0;i<mapping.count;i++){
      const p=mapping.start+i*12,first=u32(p)
      requireValue(first>lastFirst && first<=offsets.count && (i!==0||first===1) &&
        u32(p+4)>0 && u32(p+8)===1,'chunk_map')
      lastFirst=first
    }
    let sample=0,mapIndex=0,lastEnd=0
    for(let i=1;i<=offsets.count;i++){
      while(mapIndex+1<mapping.count && u32(mapping.start+(mapIndex+1)*12)<=i)mapIndex++
      const n=u32(mapping.start+mapIndex*12+4)
      requireValue(sample+n<=count,'chunk_samples')
      const p=offsets.start+(i-1)*offsetWidth,offset=offsetWidth===4?u32(p):u64(p)
      let length=0
      for(let j=0;j<n;j++){
        const nbytes=fixed||u32(sizes.start+12+(sample+j)*4)
        requireValue(nbytes>0,'empty_sample');length+=nbytes
      }
      // Binary search keeps hostile multi-mdat files from causing a quadratic scan.
      let lo=0,hi=mdats.length-1,range: Box | undefined
      while(lo<=hi){const mid=(lo+hi)>>>1;if(mdats[mid].start<=offset){range=mdats[mid];lo=mid+1}else hi=mid-1}
      requireValue(range && offset+length<=range.end,'sample_outside_mdat')
      requireValue(offset>=lastEnd,'chunk_overlap')
      lastEnd=offset+length;sample+=n
    }
    requireValue(sample===count,'unmapped_samples')
    // Non-trivial edit lists change presentation duration: fail closed.
    for(const edts of trackChildren.filter(b=>b.type==='edts')){
      const elst=one(children(edts),'elst');bound(elst.start,8,elst.end)
      const v=u8(elst.start);requireValue(v===0||v===1,'edit_list')
      const stride=v===0?12:20
      requireValue(u32(elst.start+4)===1 && elst.start+8+stride===elst.end,'edit_list')
      const p=elst.start+8,mt=v===0?view.getInt32(p+4):Number(view.getBigInt64(p+8))
      const rate=p+(v===0?8:16)
      requireValue(mt>=0 && mt<=largestDelta*2 && u16(rate)===1 && u16(rate+2)===0,'edit_list')
    }
    tracks.push({container:'mp4',codec,width,height,duration_ms:Math.round(duration*1000),fps,
      content_length:size,parse_valid:true,integrity:'structural_sample_bounds'})
  }
  requireValue(tracks.length===1,'video_track_count')
  return tracks[0]
}
export async function probeMp4(bytes: Uint8Array, creatorMaxSeconds?: number) {
  const metadata = parseMp4Structure(bytes, creatorMaxSeconds)
  const digest = await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>)
  const content_sha256 = Array.from(new Uint8Array(digest), x=>x.toString(16).padStart(2,'0')).join('')
  return {...metadata,content_sha256}
}
