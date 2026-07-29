import { SMART_UI } from '../../design-system/tokens'

export default function ProductSectionHeading({ eyebrow, title, description, action, id }) {
  return <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div className="max-w-3xl">
      {eyebrow && <p className={SMART_UI.eyebrow}>{eyebrow}</p>}
      <h2 id={id} className={`${SMART_UI.sectionTitle} ${eyebrow ? 'mt-2' : ''}`}>{title}</h2>
      {description && <p className={`${SMART_UI.body} mt-3`}>{description}</p>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
}
