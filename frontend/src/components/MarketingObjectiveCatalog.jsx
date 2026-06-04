import MarketingObjectiveCard from './MarketingObjectiveCard'
import { MARKETING_OBJECTIVES } from '../data/marketingObjectives'

export default function MarketingObjectiveCatalog({
  selectedTemplateIds = [],
  onToggleObjective,
}) {
  const selected = new Set(selectedTemplateIds)

  const isSelected = (objective) => (
    objective.selectedTemplates.every((templateId) => selected.has(templateId))
  )

  return (
    <section>
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
        {MARKETING_OBJECTIVES.map((objective) => (
          <MarketingObjectiveCard
            key={objective.id}
            objective={objective}
            selected={isSelected(objective)}
            onToggle={onToggleObjective}
          />
        ))}
      </div>
    </section>
  )
}
