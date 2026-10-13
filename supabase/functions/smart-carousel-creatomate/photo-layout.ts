export const SMART_CAROUSEL_CANVAS = Object.freeze({ width: 1080, height: 1920 })

type Canvas = typeof SMART_CAROUSEL_CANVAS

export type ContainedPhotoFrame = {
  x: number
  y: number
  width: number
  height: number
  scale: number
  sourceVisible: { left: number, top: number, right: number, bottom: number }
}

// This is the same geometry used by an image element with `fit: 'contain'`.
// Keeping it explicit makes the no-crop guarantee testable for every source ratio.
export function calculateContainedPhotoFrame(
  sourceWidth: number,
  sourceHeight: number,
  canvas: Canvas = SMART_CAROUSEL_CANVAS,
): ContainedPhotoFrame {
  if (!Number.isFinite(sourceWidth) || !Number.isFinite(sourceHeight) || sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error('Photo dimensions must be positive finite values.')
  }

  const scale = Math.min(canvas.width / sourceWidth, canvas.height / sourceHeight)
  const width = sourceWidth * scale
  const height = sourceHeight * scale

  return {
    x: (canvas.width - width) / 2,
    y: (canvas.height - height) / 2,
    width,
    height,
    scale,
    sourceVisible: { left: 0, top: 0, right: sourceWidth, bottom: sourceHeight },
  }
}

type PhotoLayerOptions = {
  sceneDuration: number
  transitionDuration: number
}

// The backdrop may cover the vertical canvas because it is decorative only. The
// foreground is the customer photo and must always use contain, without motion.
export function buildSmartCarouselPhotoLayers(imageUrls: string[], options: PhotoLayerOptions) {
  const sceneOffset = options.sceneDuration - options.transitionDuration
  const fadeFor = (index: number) => index > 0 ? [{
    duration: options.transitionDuration,
    easing: 'cubic-in-out',
    transition: true,
    type: 'fade',
  }] : []

  return {
    backgrounds: imageUrls.map((source, index) => ({
      name: 'Property-Photo-Backdrop',
      type: 'image',
      track: 1,
      time: index * sceneOffset,
      duration: options.sceneDuration,
      x: '50%',
      y: '50%',
      width: '100%',
      height: '100%',
      source,
      fit: 'cover',
      clip: true,
      opacity: '24%',
      animations: fadeFor(index),
    })),
    foregrounds: imageUrls.map((source, index) => ({
      name: 'Property-Photo-Full-Frame',
      type: 'image',
      track: 2,
      time: index * sceneOffset,
      duration: options.sceneDuration,
      x: '50%',
      y: '50%',
      width: '100%',
      height: '100%',
      source,
      fit: 'contain',
      clip: false,
      animations: fadeFor(index),
    })),
  }
}
