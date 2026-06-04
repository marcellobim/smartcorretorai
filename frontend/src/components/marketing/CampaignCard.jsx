import { Download, Trash2, ExternalLink, Instagram, Facebook, MessageCircle } from 'lucide-react'
import { formatDateTime } from '../../utils/formatters'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'

const statusConfig = {
  concluido: { label: 'Concluído', variant: 'success' },
  gerando: { label: 'Gerando...', variant: 'warning' },
  erro: { label: 'Erro', variant: 'danger' },
}

const redesIcons = {
  instagram_feed: Instagram,
  instagram_stories: Instagram,
  facebook: Facebook,
  whatsapp: MessageCircle,
}

export function CampaignCard({ campaign, onDelete, onDownload }) {
  const status = statusConfig[campaign.status] || statusConfig.concluido

  return (
    <div className="card overflow-hidden hover:shadow-md transition-shadow duration-200">
      <div className="p-4 border-b border-gray-50">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">{campaign.titulo}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(campaign.created_at)}</p>
          </div>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
      </div>

      {campaign.preview_url && (
        <div className="relative h-40 bg-gray-100 overflow-hidden">
          <img
            src={campaign.preview_url}
            alt="Preview da campanha"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
            <a
              href={campaign.preview_url}
              target="_blank"
              rel="noreferrer"
              className="p-2 bg-white rounded-full shadow-lg"
            >
              <ExternalLink className="w-4 h-4 text-gray-700" />
            </a>
          </div>
        </div>
      )}

      <div className="p-4">
        <p className="text-xs text-gray-500 font-medium mb-2">Redes sociais</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          {campaign.redes_sociais?.map((rede) => {
            const Icon = redesIcons[rede] || ExternalLink
            return (
              <span key={rede} className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-md text-xs text-gray-600">
                <Icon className="w-3 h-3" />
                {rede.replace('_', ' ')}
              </span>
            )
          })}
        </div>

        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
          <Button
            variant="primary"
            size="sm"
            className="flex-1"
            onClick={() => onDownload(campaign)}
            disabled={campaign.status !== 'concluido'}
          >
            <Download className="w-3.5 h-3.5" />
            Baixar campanha
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDelete(campaign)}>
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
          </Button>
        </div>
      </div>
    </div>
  )
}
