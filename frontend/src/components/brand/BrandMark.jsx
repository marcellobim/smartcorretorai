const SOURCE_SIZES = [32, 64, 128, 256, 512, 1024]

function getSourceSize(size) {
  return SOURCE_SIZES.find(candidate => candidate >= size) || SOURCE_SIZES.at(-1)
}

export default function BrandMark({
  size = 32,
  alt = 'SmartCorretorAI',
  decorative = false,
  className = '',
}) {
  const sourceSize = getSourceSize(size)

  return (
    <img
      src={`/brand/smartcorretorai-symbol-${sourceSize}.png`}
      width={size}
      height={size}
      alt={decorative ? '' : alt}
      aria-hidden={decorative || undefined}
      className={`block shrink-0 object-contain ${className}`}
    />
  )
}
