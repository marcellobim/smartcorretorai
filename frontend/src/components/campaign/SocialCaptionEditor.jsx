export const SOCIAL_CAPTION_MAX_LENGTH = 2200

export const countSocialCaptionCharacters = value => Array.from(typeof value === 'string' ? value : '').length

export default function SocialCaptionEditor({ value, onChange, disabled = false, placeholder = '', uiLabels }) {
  const count = countSocialCaptionCharacters(value)
  const update = event => {
    const next = event.target.value
    if (countSocialCaptionCharacters(next) <= SOCIAL_CAPTION_MAX_LENGTH) onChange?.(next)
  }

  return (
    <div>
      <label htmlFor="social-publication-caption" className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
        {uiLabels?.label ?? 'TEXTO DA PUBLICAÇÃO (OPCIONAL)'}
      </label>
      <textarea
        id="social-publication-caption"
        value={value}
        onChange={update}
        disabled={disabled}
        placeholder={placeholder}
        rows={8}
        className="mt-2 min-h-40 w-full resize-y rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-600"
      />
      <div className="mt-2 flex items-center justify-between gap-3 text-xs font-semibold text-slate-500">
        <span>{uiLabels?.help ?? 'Você pode editar, substituir ou apagar todo o texto.'}</span>
        <span aria-label={uiLabels?.limit ?? 'Limite da legenda'}>{count}/{SOCIAL_CAPTION_MAX_LENGTH}</span>
      </div>
    </div>
  )
}
