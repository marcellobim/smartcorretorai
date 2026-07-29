import { forwardRef } from 'react'

const variants = {
  default: 'rounded-3xl bg-white shadow-[0_20px_55px_-40px_rgba(15,23,42,0.45)] ring-1 ring-slate-200/70',
  muted: 'rounded-3xl bg-slate-50/90 ring-1 ring-slate-200/70',
  flat: 'rounded-3xl bg-white ring-1 ring-slate-200/70',
}

const ProductCard = forwardRef(function ProductCard({ as: Component = 'section', variant = 'default', className = '', children, ...props }, ref) {
  return <Component ref={ref} className={`${variants[variant] || variants.default} ${className}`} {...props}>{children}</Component>
})

export default ProductCard
