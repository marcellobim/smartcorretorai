import { SMART_UI } from '../../design-system/tokens'

const variants = {
  primary: 'border-primary-800 bg-primary-800 text-white shadow-lg shadow-primary-200 hover:border-primary-700 hover:bg-primary-700',
  secondary: 'border-primary-200 bg-white text-primary-800 hover:border-primary-400 hover:bg-primary-50',
  ghost: 'border-transparent bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-950',
}

const sizes = {
  sm: 'min-h-10 px-3.5 py-2 text-xs',
  md: 'min-h-11 px-4 py-2.5 text-sm',
  lg: 'min-h-12 px-6 py-3 text-base',
}

export default function ProductButton({ as: Component = 'button', variant = 'primary', size = 'md', className = '', children, ...props }) {
  return <Component className={`inline-flex items-center justify-center gap-2 rounded-smart-control border font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${SMART_UI.focus} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`} {...props}>{children}</Component>
}
