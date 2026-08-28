import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ExemplaresService, Exemplar } from '@/services/exemplares'
import { Titulo } from '@/services/titulos'
import { ConfirmModal } from '@/components/ConfirmModal'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { Layers, Plus, Trash2, MapPin, Loader2, BookOpen } from 'lucide-react'

interface CopiesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  titulo: Titulo | null
  onCopiesUpdated: () => void
  onRequestLoan?: (exemplarId: string) => void
}

export function CopiesModal({
  open,
  onOpenChange,
  titulo,
  onCopiesUpdated,
  onRequestLoan,
}: CopiesModalProps) {
  const { isOperadorOrAdmin } = useAuth()
  const { toast } = useToast()
  const [exemplares, setExemplares] = useState<Exemplar[]>([])
  const [loading, setLoading] = useState(false)
  const [addingCopy, setAddingCopy] = useState(false)

  const [newLocation, setNewLocation] = useState('Estante Geral')
  const [newQuantity, setNewQuantity] = useState(1)

  // Confirm delete copy
  const [deleteCopyConfirmOpen, setDeleteCopyConfirmOpen] = useState(false)
  const [copyIdToDelete, setCopyIdToDelete] = useState<string | null>(null)
  const [deleteCopyLoading, setDeleteCopyLoading] = useState(false)

  useEffect(() => {
    if (open && titulo) {
      loadCopies()
    }
  }, [open, titulo])

  const loadCopies = async () => {
    if (!titulo) return
    setLoading(true)
    try {
      const data = await ExemplaresService.getByTitulo(titulo.id_titulo)
      setExemplares(data || [])
    } catch (err: any) {
      toast({
        title: 'Erro ao listar exemplares',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAddCopies = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!titulo) return
    setAddingCopy(true)
    try {
      await ExemplaresService.create(titulo.id_titulo, newLocation, Number(newQuantity))
      toast({
        title: 'Cópias adicionadas',
        description: `${newQuantity} novo(s) exemplar(es) cadastrado(s).`,
      })
      await loadCopies()
      onCopiesUpdated()
      setNewQuantity(1)
    } catch (err: any) {
      toast({ title: 'Erro ao criar exemplares', description: err.message, variant: 'destructive' })
    } finally {
      setAddingCopy(false)
    }
  }

  const handleStatusChange = async (id_exemplar: string, newStatus: string) => {
    try {
      await ExemplaresService.updateStatus(id_exemplar, newStatus)
      toast({
        title: 'Status atualizado',
        description: `Exemplar ${id_exemplar} definido como ${newStatus}.`,
      })
      await loadCopies()
      onCopiesUpdated()
    } catch (err: any) {
      toast({ title: 'Erro ao alterar status', description: err.message, variant: 'destructive' })
    }
  }

  const handleDeleteCopy = (id_exemplar: string) => {
    setCopyIdToDelete(id_exemplar)
    setDeleteCopyConfirmOpen(true)
  }

  const executeDeleteCopy = async () => {
    if (!copyIdToDelete) return
    setDeleteCopyLoading(true)
    try {
      await ExemplaresService.delete(copyIdToDelete)
      toast({
        title: 'Exemplar removido',
        description: `Exemplar ${copyIdToDelete} excluído com sucesso.`,
      })
      setDeleteCopyConfirmOpen(false)
      setCopyIdToDelete(null)
      await loadCopies()
      onCopiesUpdated()
    } catch (err: any) {
      toast({ title: 'Não foi possível remover', description: err.message, variant: 'destructive' })
    } finally {
      setDeleteCopyLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Disponivel':
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-100 hover:text-emerald-800">
            Disponível
          </Badge>
        )
      case 'Emprestado':
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-100 hover:text-amber-800">
            Emprestado
          </Badge>
        )
      case 'Manutencao':
        return (
          <Badge className="bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-100 hover:text-rose-800">
            Em Manutenção
          </Badge>
        )
      case 'Perdido':
        return (
          <Badge className="bg-slate-200 text-slate-800 border-slate-300 hover:bg-slate-200 hover:text-slate-800">
            Perdido / Baixado
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900">
            <Layers className="w-5 h-5 text-emerald-600" />
            Controle de Exemplares Físicos
          </DialogTitle>
          <DialogDescription>
            Obra: <span className="font-semibold text-slate-800">{titulo?.titulo_de_livro}</span> (
            {titulo?.autor})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Add copy form for operators/admins */}
          {isOperadorOrAdmin && (
            <form
              onSubmit={handleAddCopies}
              className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5"
            >
              <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-emerald-600" />
                Adicionar Novas Cópias Físicas
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="loc" className="text-[11px] text-slate-600">
                    Localização / Estante
                  </Label>
                  <Input
                    id="loc"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    placeholder="Ex: Estante B - 2ª Prateleira"
                    className="h-8 text-xs bg-white"
                  />
                </div>
                <div>
                  <Label htmlFor="qty" className="text-[11px] text-slate-600">
                    Qtd.
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="qty"
                      type="number"
                      min={1}
                      max={20}
                      value={newQuantity}
                      onChange={(e) => setNewQuantity(Number(e.target.value))}
                      className="h-8 text-xs bg-white"
                    />
                    <Button
                      type="submit"
                      size="sm"
                      className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3"
                      disabled={addingCopy}
                    >
                      {addingCopy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Adicionar'}
                    </Button>
                  </div>
                </div>
              </div>
            </form>
          )}

          {/* List of copies */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-slate-700">
              Cópias Cadastradas ({exemplares.length})
            </h4>

            {loading ? (
              <div className="py-8 text-center text-slate-400 flex flex-col items-center justify-center gap-1">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                <span className="text-xs">Carregando exemplares...</span>
              </div>
            ) : exemplares.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                Nenhum exemplar físico registrado para esta obra. Adicione um acima.
              </div>
            ) : (
              <div className="divide-y divide-slate-200 border rounded-lg overflow-hidden bg-white">
                {exemplares.map((ex) => (
                  <div
                    key={ex.id_exemplar}
                    className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/70 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded border">
                          {ex.id_exemplar}
                        </span>
                        <span className="text-xs text-slate-500">Cópia #{ex.seq}</span>
                        {getStatusBadge(ex.status)}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>{ex.localizacao || 'Sem localização definida'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-center">
                      {ex.status === 'Disponivel' && onRequestLoan && isOperadorOrAdmin && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                          onClick={() => {
                            onOpenChange(false)
                            onRequestLoan(ex.id_exemplar)
                          }}
                        >
                          <BookOpen className="w-3 h-3 mr-1" />
                          Emprestar
                        </Button>
                      )}

                      {isOperadorOrAdmin && (
                        <>
                          {ex.status === 'Disponivel' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-amber-700 hover:bg-amber-50"
                              onClick={() => handleStatusChange(ex.id_exemplar, 'Manutencao')}
                            >
                              Manutenção
                            </Button>
                          )}
                          {ex.status === 'Manutencao' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-emerald-700 hover:bg-emerald-50"
                              onClick={() => handleStatusChange(ex.id_exemplar, 'Disponivel')}
                            >
                              Liberar
                            </Button>
                          )}
                          {ex.status !== 'Emprestado' && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-rose-500 hover:bg-rose-50"
                              onClick={() => handleDeleteCopy(ex.id_exemplar)}
                              title="Excluir este exemplar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>

      <ConfirmModal
        open={deleteCopyConfirmOpen}
        onOpenChange={setDeleteCopyConfirmOpen}
        title="Remover Exemplar Físico"
        description={`Deseja realmente remover o exemplar físico ${copyIdToDelete}? Esta ação excluirá este registro permanente de cópia.`}
        confirmLabel="Sim, Remover Exemplar"
        variant="destructive"
        loading={deleteCopyLoading}
        onConfirm={executeDeleteCopy}
      />
    </Dialog>
  )
}
