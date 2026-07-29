export const SMART_DESIGN_TOKENS = Object.freeze({
  color: Object.freeze({
    canvas: '#f8fafc',
    surface: '#ffffff',
    surfaceMuted: '#f1f5f9',
    text: '#0f172a',
    textMuted: '#64748b',
    border: '#dbeafe',
    brand: '#0f5f7a',
    brandStrong: '#0f2742',
    accent: '#0891b2',
  }),
  typography: Object.freeze({
    family: 'Inter, system-ui, sans-serif',
    hero: Object.freeze({ size: 'clamp(2.25rem, 5vw, 3.5rem)', weight: 900, lineHeight: 1.04 }),
    title: Object.freeze({ size: 'clamp(1.5rem, 3vw, 2rem)', weight: 900, lineHeight: 1.15 }),
    body: Object.freeze({ size: '1rem', weight: 500, lineHeight: 1.75 }),
    eyebrow: Object.freeze({ size: '0.75rem', weight: 900, letterSpacing: '0.16em' }),
  }),
  spacing: Object.freeze({ section: '2rem', card: '1.5rem', control: '0.75rem', pageX: 'clamp(1rem, 4vw, 2rem)' }),
  radius: Object.freeze({ control: '0.75rem', card: '1.5rem', hero: '2rem', phone: '2.25rem' }),
  grid: Object.freeze({ maxWidth: '80rem', contentSidebar: 'minmax(0, 1fr) 18rem', gap: '2rem' }),
  shadow: Object.freeze({ card: '0 20px 55px -40px rgba(15, 23, 42, 0.45)', floating: '0 24px 60px -42px rgba(15, 23, 42, 0.5)' }),
})

export const SMART_UI = Object.freeze({
  page: 'mx-auto w-full max-w-smart px-smart-page py-6 sm:py-8',
  card: 'rounded-smart-card border border-smart-border bg-smart-surface shadow-smart-card',
  cardMuted: 'rounded-smart-card border border-smart-border bg-smart-muted',
  eyebrow: 'text-xs font-black uppercase tracking-[0.16em] text-primary-600',
  sectionTitle: 'text-2xl font-black tracking-[-0.025em] text-slate-950 sm:text-3xl',
  body: 'text-sm font-medium leading-7 text-slate-600 sm:text-base',
  focus: 'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
})
