import { renderStudioHeroMotionSampleMainReel } from '../studio-hero-motion/sample-renderer.ts'

function readArg(name: string) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : ''
}

async function main() {
  const sourceVideoPath = readArg('--source')
  const outputPath = readArg('--out')

  if (!sourceVideoPath || !outputPath) {
    console.log([
      'Studio Hero Motion sample reel renderer',
      '',
      'Usage:',
      '  node core/smart-motion-engine/cli/render-studio-hero-motion-sample-reel.ts --source "C:/videos/corretor.mp4" --out "core/smart-motion-engine/output/sample-reel.mp4"',
      '',
      'Notes:',
      '  - Uses the official studioHeroMotionSampleCampaign contract.',
      '  - Renders only the main reels MP4 from contract cuts.',
      '  - Applies only the finishing layer configured by the contract.',
      '  - Does not render texts, zoom, speed ramp, CTA overlays or smart clips yet.',
    ].join('\n'))
    return
  }

  const result = await renderStudioHeroMotionSampleMainReel({
    sourceVideoPath,
    outputPath,
  })

  console.log(JSON.stringify({
    outputPath: result.outputPath,
    cutCount: result.cutCount,
    totalDurationSeconds: result.totalDurationSeconds,
    finishing: result.finishing,
    smartClips: result.smartClips.status,
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
