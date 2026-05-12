import { useState } from 'react'
import { Plus, Search, SlidersHorizontal } from 'lucide-react'
import toast from 'react-hot-toast'
import Header from '../components/layout/Header'
import { PropertyCard } from '../components/marketing/PropertyCard'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Input, Select, Textarea } from '../components/ui/Input'
import { useProperties } from '../hooks/useProperties'
import { useForm } from 'react-hook-form'
import { TIPOS_IMOVEL, FINALIDADES } from '../utils/formatters'
import { useNavigate } from 'react-router-dom'

export default function MeusImoveis() {
  const { properties, loading, create, update, remove } = useProperties()
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingProperty, setEditingProperty] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const navigate = useNavigate()
  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm()

  const filtered = properties.filter((p) =>
    p.titulo?.toLowerCase().includes(search.toLowerCase()) ||
    p.bairro?.toLowerCase().includes(search.toLowerCase()) ||
    p.cidade?.toLowerCase().includes(search.toLowerCase())
  )

  const openCreate = () => {
    setEditingProperty(null)
    reset({})
    setShowModal(true)
  }

  const openEdit = (property) => {
    setEditingProperty(property)
    reset(property)
    setShowModal(true)
  }

  const onSubmit = async (data) => {
    try {
      if (editingProperty) {
        await update(editingProperty.id, data)
        toast.success('Imóvel atualizado!')
      } else {
        await create(data)
        toast.success('Imóvel cadastrado!')
      }
      setShowModal(false)
      reset({})
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleDelete = async () => {
    try {
      await remove(confirmDelete.id)
      toast.success('Imóvel excluído')
      setConfirmDelete(null)
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleGenerateCampaign = (property) => {
    navigate('/nova-campanha', { state: { property } })
  }

  return (
    <div>
      <Header title="Meus Imóveis" subtitle={`${properties.length} imóvel${properties.length !== 1 ? 's' : ''} cadastrado${properties.length !== 1 ? 's' : ''}`} />

      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar imóveis..."
              className="input pl-9"
            />
          </div>
          <Button variant="secondary">
            <SlidersHorizontal className="w-4 h-4" />
            Filtros
          </Button>
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4" />
            Novo imóvel
          </Button>
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card animate-pulse">
                <div className="h-44 bg-gray-200 rounded-t-xl" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                  <div className="h-6 bg-gray-200 rounded w-1/3 mt-3" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Plus className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              {search ? 'Nenhum imóvel encontrado' : 'Nenhum imóvel cadastrado'}
            </h3>
            <p className="text-gray-500 text-sm mt-2">
              {search ? 'Tente outro termo de busca' : 'Cadastre seu primeiro imóvel para começar a gerar campanhas'}
            </p>
            {!search && (
              <Button className="mt-4" onClick={openCreate}>
                <Plus className="w-4 h-4" />
                Cadastrar imóvel
              </Button>
            )}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((property) => (
              <PropertyCard
                key={property.id}
                property={property}
                onEdit={openEdit}
                onDelete={setConfirmDelete}
                onGenerateCampaign={handleGenerateCampaign}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal: Criar/Editar Imóvel */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingProperty ? 'Editar imóvel' : 'Novo imóvel'}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Título"
            placeholder="Ex: Apartamento 3 quartos em Moema"
            error={errors.titulo?.message}
            {...register('titulo', { required: 'Obrigatório' })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Tipo" error={errors.tipo?.message} {...register('tipo', { required: 'Obrigatório' })}>
              <option value="">Selecione</option>
              {TIPOS_IMOVEL.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
            <Select label="Finalidade" error={errors.finalidade?.message} {...register('finalidade', { required: 'Obrigatório' })}>
              <option value="">Selecione</option>
              {FINALIDADES.map((f) => <option key={f} value={f}>{f}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Preço (R$)" type="number" placeholder="500000" error={errors.preco?.message} {...register('preco', { required: 'Obrigatório' })} />
            <Input label="Área (m²)" type="number" placeholder="80" {...register('area')} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Quartos" type="number" placeholder="3" {...register('quartos')} />
            <Input label="Banheiros" type="number" placeholder="2" {...register('banheiros')} />
            <Input label="Vagas" type="number" placeholder="2" {...register('vagas')} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Bairro" placeholder="Moema" error={errors.bairro?.message} {...register('bairro', { required: 'Obrigatório' })} />
            <Input label="Cidade" placeholder="São Paulo" error={errors.cidade?.message} {...register('cidade', { required: 'Obrigatório' })} />
            <Select label="UF" error={errors.estado?.message} {...register('estado', { required: 'Obrigatório' })}>
              <option value="">UF</option>
              {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map((uf) => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </Select>
          </div>
          <Textarea label="Descrição" placeholder="Descreva o imóvel..." rows={3} {...register('descricao')} />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button type="submit" loading={isSubmitting} className="flex-1">
              {editingProperty ? 'Salvar alterações' : 'Cadastrar imóvel'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirm Delete */}
      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Excluir imóvel" size="sm">
        <p className="text-sm text-gray-600">
          Tem certeza que deseja excluir <strong>{confirmDelete?.titulo}</strong>? Esta ação não pode ser desfeita.
        </p>
        <div className="flex gap-3 mt-5">
          <Button variant="secondary" className="flex-1" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
          <Button variant="danger" className="flex-1" onClick={handleDelete}>Excluir</Button>
        </div>
      </Modal>
    </div>
  )
}
