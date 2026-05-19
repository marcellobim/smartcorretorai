import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Zap, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'
import { Input, Select } from '../components/ui/Input'
import { Button } from '../components/ui/Button'

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false)
  const { register: authRegister, loading } = useAuth()
  const navigate = useNavigate()
  const { register, handleSubmit, formState: { errors } } = useForm()

  const onSubmit = async (data) => {
    try {
      await authRegister({
        email: data.email,
        password: data.senha,
        nome: data.nome,
        telefone: data.telefone,
        creci: data.creci,
        estado: data.estado,
      })
      toast.success('Conta criada! Verifique seu email para confirmar o cadastro.')
      navigate('/login')
    } catch (err) {
      if (err.message.includes('User already registered')) {
        toast.error('Este email já está cadastrado.')
      } else {
        toast.error(err.message)
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gray-50">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 gradient-primary rounded-lg flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-gray-900">SmartCorretorAI</span>
        </div>

        <h1 className="text-2xl font-bold text-gray-900">Crie sua conta grátis</h1>
        <p className="mt-1 text-sm text-gray-500">
          7 dias grátis, sem cartão de crédito. Já tem conta?{' '}
          <Link to="/login" className="text-primary-600 font-semibold hover:text-primary-700">
            Entrar
          </Link>
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4">
          <Input
            label="Nome completo"
            placeholder="Seu nome"
            error={errors.nome?.message}
            {...register('nome', { required: 'Nome obrigatório', minLength: { value: 3, message: 'Mínimo 3 caracteres' } })}
          />

          <Input
            label="E-mail profissional"
            type="email"
            placeholder="seu@email.com"
            error={errors.email?.message}
            {...register('email', {
              required: 'E-mail obrigatório',
              pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'E-mail inválido' },
            })}
          />

          <Input
            label="Telefone / WhatsApp"
            type="tel"
            placeholder="(11) 99999-9999"
            error={errors.telefone?.message}
            {...register('telefone', {
              required: 'Telefone obrigatório',
              pattern: { value: /^[\d\s\(\)\-\+]{10,15}$/, message: 'Telefone inválido' },
            })}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="CRECI"
              placeholder="Ex: 12345-F"
              hint="Opcional"
              {...register('creci')}
            />
            <Select
              label="Estado (UF)"
              error={errors.estado?.message}
              {...register('estado', { required: 'Estado obrigatório' })}
            >
              <option value="">Selecione</option>
              {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map((uf) => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </Select>
          </div>

          <div className="relative">
            <Input
              label="Senha"
              type={showPassword ? 'text' : 'password'}
              placeholder="Mínimo 8 caracteres"
              error={errors.senha?.message}
              {...register('senha', {
                required: 'Senha obrigatória',
                minLength: { value: 8, message: 'Mínimo 8 caracteres' },
              })}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-9 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex items-start gap-2 pt-1">
            <input
              type="checkbox"
              id="termos"
              className="mt-0.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              {...register('termos', { required: 'Aceite os termos para continuar' })}
            />
            <label htmlFor="termos" className="text-sm text-gray-600">
              Concordo com os{' '}
              <a href="#" className="text-primary-600 hover:underline">Termos de Uso</a>{' '}
              e{' '}
              <a href="#" className="text-primary-600 hover:underline">Política de Privacidade</a>
            </label>
          </div>
          {errors.termos && <p className="text-xs text-red-500">{errors.termos.message}</p>}

          <Button type="submit" loading={loading} className="w-full mt-2">
            Criar conta grátis
          </Button>
        </form>
      </div>
    </div>
  )
}
