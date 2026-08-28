import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { LeitoresService, LeitorWithStats, Leitor } from '@/services/leitores'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Users,
  Search,
  UserPlus,
  Edit2,
  Trash2,
  Lock,
  Unlock,
  Loader2,
  Repeat,
  AlertTriangle,
  Mail,
  Phone,
} from 'lucide-react'
import { ReaderModal } from '@/components/ReaderModal'
import { formatCPF } from '@/lib/utils'
import { ConfirmModal } from '@/components/ConfirmModal'
import { useToast } from '@/hooks/use-toast'

export default function Leitores() {
  const { isOperadorOrAdmin, isAdmin } = useAuth()
  const { toast } = useToast()

  const [readers, setReaders] = useState<LeitorWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'ativos' | 'bloqueados'>('all')

  const [readerModalOpen, setReaderModalOpen] = useState(false)
  const [readerToEdit, setReaderToEdit] = useState<Leitor | null>(null)

  // Confirm modals state
  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false)
  const [readerToToggleBlock, setReaderToToggleBlock] = useState<LeitorWithStats | null>(null)
  const [blockLoading, setBlockLoading] = useState(false)

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [readerToDelete, setReaderToDelete] = useState<LeitorWithStats | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const getInitials = (name?: string) => {
    if (!name) return 'L'
    const parts = name.trim().split(' ')
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    return name.substring(0, 2).toUpperCase()
  }

  const loadReaders = async () => {
    setLoading(true)
    try {
      const data = await LeitoresService.getAll(searchQuery, filterStatus)
      setReaders(data)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar leitores',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReaders()
  }, [filterStatus])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    loadReaders()
  }

  const handleToggleBlock = (reader: LeitorWithStats) => {
    setReaderToToggleBlock(reader)
    setBlockConfirmOpen(true)
  }

  const executeToggleBlock = async () => {
    if (!readerToToggleBlock) return
    setBlockLoading(true)
    try {
      await LeitoresService.toggleBlock(
        readerToToggleBlock.id_leitor,
        readerToToggleBlock.bloqueado,
      )
      toast({
        title: readerToToggleBlock.bloqueado ? 'Leitor desbloqueado' : 'Leitor bloqueado',
        description: `O status do leitor ${readerToToggleBlock.nome_do_leitor} foi atualizado com sucesso.`,
      })
      setBlockConfirmOpen(false)
      setReaderToToggleBlock(null)
      loadReaders()
    } catch (err: any) {
      toast({
        title: 'Erro ao atualizar status',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setBlockLoading(false)
    }
  }

  const handleDelete = (reader: LeitorWithStats) => {
    setReaderToDelete(reader)
    setDeleteConfirmOpen(true)
  }

  const executeDelete = async () => {
    if (!readerToDelete) return
    setDeleteLoading(true)
    try {
      await LeitoresService.delete(readerToDelete.id_leitor)
      toast({
        title: 'Leitor removido',
        description: `O cadastro de ${readerToDelete.nome_do_leitor} foi excluído com sucesso.`,
      })
      setDeleteConfirmOpen(false)
      setReaderToDelete(null)
      loadReaders()
    } catch (err: any) {
      toast({
        title: 'Não foi possível excluir',
        description: err.message || 'Verifique se não há empréstimos pendentes.',
        variant: 'destructive',
      })
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-600" />
            Gestão de Leitores & Usuários
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Cadastre leitores, consulte histórico de empréstimos e gerencie permissões de retirada.
          </p>
        </div>

        {isOperadorOrAdmin && (
          <Button
            onClick={() => {
              setReaderToEdit(null)
              setReaderModalOpen(true)
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-2 shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            Cadastrar Novo Leitor
          </Button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearchSubmit} className="flex gap-2 flex-1">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Buscar por nome, e-mail, telefone ou CPF..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs sm:text-sm bg-white"
            />
          </div>
          <Button
            type="submit"
            variant="default"
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-4"
          >
            Buscar
          </Button>
        </form>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg self-start sm:self-auto">
          <Button
            size="sm"
            variant={filterStatus === 'all' ? 'default' : 'ghost'}
            className={`h-7 text-xs ${filterStatus === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
            onClick={() => setFilterStatus('all')}
          >
            Todos
          </Button>
          <Button
            size="sm"
            variant={filterStatus === 'ativos' ? 'default' : 'ghost'}
            className={`h-7 text-xs ${filterStatus === 'ativos' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
            onClick={() => setFilterStatus('ativos')}
          >
            Ativos
          </Button>
          <Button
            size="sm"
            variant={filterStatus === 'bloqueados' ? 'default' : 'ghost'}
            className={`h-7 text-xs ${filterStatus === 'bloqueados' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
            onClick={() => setFilterStatus('bloqueados')}
          >
            Bloqueados
          </Button>
        </div>
      </div>

      {/* Readers List */}
      {loading ? (
        <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <p className="text-xs text-slate-500 font-medium">Carregando leitores cadastrados...</p>
        </div>
      ) : readers.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-200 p-12 text-center bg-slate-50/50">
          <div className="max-w-md mx-auto space-y-3">
            <Users className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-semibold text-slate-800">Nenhum leitor encontrado</h3>
            <p className="text-xs text-slate-500">
              Não encontramos nenhum leitor para o termo buscado. Cadastre um novo leitor no botão
              acima.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {readers.map((reader) => (
            <Card
              key={reader.id_leitor}
              className={`border transition-all flex flex-col justify-between bg-white ${
                reader.bloqueado
                  ? 'border-rose-200 bg-rose-50/10'
                  : 'border-slate-200 hover:border-emerald-300 shadow-sm'
              }`}
            >
              <div className="p-4 space-y-3">
                {/* Header with Photo */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10 border border-slate-200 shrink-0">
                      {reader.foto && (
                        <AvatarImage
                          src={reader.foto}
                          alt={reader.nome_do_leitor || ''}
                          className="object-cover"
                        />
                      )}
                      <AvatarFallback className="bg-emerald-100 text-emerald-800 text-xs font-bold">
                        {getInitials(reader.nome_do_leitor || '')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-0.5 min-w-0">
                      <span className="font-mono text-[10px] text-slate-400">
                        ID #{reader.id_leitor}
                      </span>
                      <h3 className="font-bold text-slate-900 text-sm leading-tight line-clamp-1">
                        {reader.nome_do_leitor}
                      </h3>
                    </div>
                  </div>

                  {reader.bloqueado ? (
                    <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-100 px-2.5 py-0.5 text-[10px] font-medium text-rose-800 gap-1 shrink-0 select-none">
                      <Lock className="w-3 h-3 text-rose-600" />
                      Bloqueado
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-medium text-emerald-700 shrink-0 select-none">
                      Ativo
                    </span>
                  )}
                </div>

                {/* Contact Info */}
                <div className="space-y-1 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5 truncate">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{reader.email}</span>
                  </div>
                  {reader.telefone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{reader.telefone}</span>
                    </div>
                  )}
                  {reader.cpf && (
                    <div className="text-[11px] text-slate-400 font-mono">
                      CPF: {formatCPF(reader.cpf)}
                    </div>
                  )}
                </div>

                {/* Loans Stats */}
                <div className="pt-2 flex items-center justify-between text-xs border-t border-slate-100 text-slate-500">
                  <span className="flex items-center gap-1">
                    <Repeat className="w-3.5 h-3.5 text-emerald-600" />
                    {reader.emprestimos_ativos} empréstimo(s) ativo(s)
                  </span>

                  {reader.emprestimos_atrasados > 0 && (
                    <span className="text-rose-600 font-semibold flex items-center gap-0.5">
                      <AlertTriangle className="w-3 h-3" />
                      {reader.emprestimos_atrasados} atrasado(s)
                    </span>
                  )}
                </div>
              </div>

              {/* Bottom Actions */}
              {isOperadorOrAdmin && (
                <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <Button
                    size="sm"
                    variant="ghost"
                    className={`h-7 text-xs px-2 gap-1 ${
                      reader.bloqueado
                        ? 'text-emerald-700 hover:bg-emerald-50'
                        : 'text-amber-700 hover:bg-amber-50'
                    }`}
                    onClick={() => handleToggleBlock(reader)}
                  >
                    {reader.bloqueado ? (
                      <>
                        <Unlock className="w-3 h-3" />
                        Desbloquear
                      </>
                    ) : (
                      <>
                        <Lock className="w-3 h-3" />
                        Bloquear
                      </>
                    )}
                  </Button>

                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-slate-500 hover:text-slate-900"
                      onClick={() => {
                        setReaderToEdit(reader)
                        setReaderModalOpen(true)
                      }}
                      title="Editar leitor"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>

                    {isAdmin && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                        onClick={() => handleDelete(reader)}
                        title="Excluir leitor"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Modals */}
      <ReaderModal
        open={readerModalOpen}
        onOpenChange={setReaderModalOpen}
        readerToEdit={readerToEdit}
        onSuccess={loadReaders}
      />

      <ConfirmModal
        open={blockConfirmOpen}
        onOpenChange={setBlockConfirmOpen}
        title={readerToToggleBlock?.bloqueado ? 'Desbloquear Leitor' : 'Bloquear Leitor'}
        description={
          readerToToggleBlock?.bloqueado
            ? `Deseja liberar o cadastro de ${readerToToggleBlock?.nome_do_leitor} para realizar novos empréstimos?`
            : `Deseja bloquear o leitor ${readerToToggleBlock?.nome_do_leitor}? Ele não poderá retirar novos exemplares até ser desbloqueado.`
        }
        confirmLabel={readerToToggleBlock?.bloqueado ? 'Sim, Desbloquear' : 'Sim, Bloquear'}
        variant={readerToToggleBlock?.bloqueado ? 'primary' : 'warning'}
        loading={blockLoading}
        onConfirm={executeToggleBlock}
      />

      <ConfirmModal
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Excluir Cadastro do Leitor"
        description={
          readerToDelete ? (
            <span>
              Tem certeza que deseja excluir o leitor{' '}
              <strong className="text-rose-600 font-bold">{readerToDelete.nome_do_leitor}</strong>?
              Esta ação removerá o cadastro permanentemente e não pode ser desfeita.
            </span>
          ) : (
            'Tem certeza que deseja excluir o leitor? Esta ação não pode ser desfeita.'
          )
        }
        confirmLabel="Sim, Excluir Cadastro"
        variant="destructive"
        loading={deleteLoading}
        onConfirm={executeDelete}
      />
    </div>
  )
}
