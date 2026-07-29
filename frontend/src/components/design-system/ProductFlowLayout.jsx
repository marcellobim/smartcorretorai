export default function ProductFlowLayout({ main, aside, className = '' }) {
  return <div className={`grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_240px] ${className}`}>
    <div className="min-w-0">{main}</div>
    <div className="min-w-0 lg:sticky lg:top-6 lg:self-start">{aside}</div>
  </div>
}
