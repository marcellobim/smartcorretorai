import { forwardRef } from 'react'

export const Input = forwardRef(function Input({ label, error, hint, className = '', ...props }, ref) {
  return (
    <div className="w-full">
      {label && <label className="label">{label}</label>}
      <input
        ref={ref}
        className={`input ${error ? 'border-red-400 focus:ring-red-400 focus:border-red-400' : ''} ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      {hint && !error && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  )
})

export const Select = forwardRef(function Select({ label, error, hint, children, className = '', ...props }, ref) {
  return (
    <div className="w-full">
      {label && <label className="label">{label}</label>}
      <select
        ref={ref}
        className={`input ${error ? 'border-red-400' : ''} ${className}`}
        {...props}
      >
        {children}
      </select>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      {hint && !error && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  )
})

export const Textarea = forwardRef(function Textarea({ label, error, hint, className = '', ...props }, ref) {
  return (
    <div className="w-full">
      {label && <label className="label">{label}</label>}
      <textarea
        ref={ref}
        className={`input resize-none ${error ? 'border-red-400' : ''} ${className}`}
        rows={4}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      {hint && !error && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  )
})
