export default function SocialNetworkIcon({ network, className = 'h-5 w-5' }) {
  if (!network?.iconSrc) return null
  return (
    <img
      src={network.iconSrc}
      alt=""
      aria-hidden="true"
      className={`${className} shrink-0 object-contain`}
      width="20"
      height="20"
    />
  )
}
