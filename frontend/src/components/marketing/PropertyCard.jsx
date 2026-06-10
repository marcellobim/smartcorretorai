import { Building2, MapPin, Bed, Bath, Car, Maximize, Edit2, Trash2, Sparkles } from 'lucide-react'
import { formatCurrency, formatArea } from '../../utils/formatters'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'

const finalidadeVariant = {
  Venda: 'success',
}

export function PropertyCard({ property, onEdit, onDelete, onGenerateCampaign }) {
  return (
    <div className="card overflow-hidden hover:shadow-md transition-shadow duration-200">
      <div className="relative h-44 bg-gradient-to-br from-gray-100 to-gray-200">
        {property.fotos?.[0] ? (
          <img
            src={property.fotos[0]}
            alt={property.titulo}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Building2 className="w-10 h-10 mb-2" />
            <span className="text-xs">Sem foto</span>
          </div>
        )}
        <div className="absolute top-3 left-3">
          <Badge variant={finalidadeVariant.Venda}>
            Venda
          </Badge>
        </div>
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-gray-900 truncate">{property.titulo}</h3>
        <p className="flex items-center gap-1 text-xs text-gray-500 mt-1 truncate">
          <MapPin className="w-3 h-3 shrink-0" />
          {property.bairro}, {property.cidade} - {property.estado}
        </p>

        <p className="text-xl font-bold text-primary-600 mt-3">
          {formatCurrency(property.preco)}
        </p>

        <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
          {property.quartos > 0 && (
            <span className="flex items-center gap-1"><Bed className="w-3.5 h-3.5" />{property.quartos}</span>
          )}
          {property.banheiros > 0 && (
            <span className="flex items-center gap-1"><Bath className="w-3.5 h-3.5" />{property.banheiros}</span>
          )}
          {property.vagas > 0 && (
            <span className="flex items-center gap-1"><Car className="w-3.5 h-3.5" />{property.vagas}</span>
          )}
          {property.area && (
            <span className="flex items-center gap-1"><Maximize className="w-3.5 h-3.5" />{formatArea(property.area)}</span>
          )}
        </div>

        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
          <Button
            variant="primary"
            size="sm"
            className="flex-1"
            onClick={() => onGenerateCampaign(property)}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Gerar Campanha
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onEdit(property)}>
            <Edit2 className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDelete(property)}>
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
          </Button>
        </div>
      </div>
    </div>
  )
}
