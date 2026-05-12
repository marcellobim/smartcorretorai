import { useState } from 'react'
import { Package, Search, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import Header from '../components/layout/Header'
import { CampaignCard } from '../components/marketing/CampaignCard'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { useCampaigns } from '../hooks/useCampaigns'

export default function PacotesGerados() {
  const { campaigns, loading, remove } = useCampaigns()
  const [search, setSearch] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)

  const filtered = campaigns.filter((c) =>
    c.titulo?.toLowerCase().includes(search.toLowerCase())
  )

  const handleDownload = (campaign) => {
    if (campaign.download_url) {
      window.open(campaign.download_url, '_blank')
    } else {
      toast.error('Arquivo não disponível ainda')
    }
  }

  const handleDelete = async () => {
    try {
      await remove(confirmDelete.id)
      toast.success('Pacote excluído')
      setConfirmDelete(null)
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div>
      <Header
        title="Pacotes Gerados"
        subtitle={`${campaigns.length} pacote${campaigns.length !== 1 ? 's' : ''} de marketing`}
      />

      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar pacotes..."
              className="input pl-9"
            />
          </div>
          <Button variant="secondary">
            <Download className="w-4 h-4" />
            Baixar todos
          </Button>
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card animate-pulse">
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
                <div className="h-40 bg-gray-200" />
                <div className="p-4 space-y-2">
                  <div className="h-3 bg-gray-100 rounded w-2/3" />
                  <div className="h-8 bg-gray-200 rounded mt-3" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              {search ? 'Nenhum pacote encontrado' : 'Nenhum pacote gerado ainda'}
            </h3>
            <p className="text-gray-500 text-sm mt-2">
              {search ? 'Tente outro termo de busca' : 'Gere sua primeira campanha de marketing para um imóvel'}
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                onDelete={setConfirmDelete}
                onDownload={handleDownload}
              />
            ))}
          </div>
        )}
      </div>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Excluir pacote" size="sm">
        <p className="text-sm text-gray-600">
          Tem certeza que deseja excluir o pacote <strong>{confirmDelete?.titulo}</strong>? Os arquivos serão removidos permanentemente.
        </p>
        <div className="flex gap-3 mt-5">
          <Button variant="secondary" className="flex-1" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
          <Button variant="danger" className="flex-1" onClick={handleDelete}>Excluir</Button>
        </div>
      </Modal>
    </div>
  )
}
