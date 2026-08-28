import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { ReservasService } from '@/services/reservas'
import { TitulosService, TituloWithStats } from '@/services/titulos'
import { LeitoresService, Leitor } from '@/services/leitores'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { BookmarkCheck, Loader2, Book, User } from 'lucide-react'

interface ReserveModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  preSelectedTituloId?: string
  onSuccess: () => void
}

export function ReserveModal({
  open,
  onOpenChange,
  preSelectedTituloId,
  onSuccess,
}: ReserveModalProps) {
  const { profile, isOperadorOrAdmin } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(false)

  const [titulos, setTitulos] = useState<TituloWithStats[]>([])
  const [leitores, setLeitores] = useState<Leitor[]>([])

  const [selectedTitulo, setSelectedTitulo] = useState<string>('')
  const [selectedLeitor, setSelectedLeitor] = useState<string>('')

  useEffect(() => {
    if (open) {
      loadData()
    }
  }, [open])

  useEffect(() => {
    if (preSelectedTituloId) {
      setSelectedTitulo(preSelectedTituloId)
    }
    if (profile?.id_leitor) {
      setSelectedLeitor(String(profile.id_leitor))
    }
  }, [preSelectedTituloId, profile, open])

  const loadData = async () => {
    setLoadingData(true)
    try {
      const [booksData, readersData] = await Promise.all([
        TitulosService.getAll('', 'all', true),
        LeitoresService.getAll('', 'ativos'),
      ])
      setTitulos(booksData)
      setLeitores(readersData)

      // If reader is logged in and not admin, match profile reader id
      if (profile?.id_leitor) {
        setSelectedLeitor(String(profile.id_leitor))
      } else if (readersData.length > 0 && !selectedLeitor) {
        setSelectedLeitor(String(readersData[0].id_leitor))
      }
    } catch (err: any) {
      toast({ title: 'Erro ao carregar dados', description: err.message, variant: 'destructive' })
    } finally {
      setLoadingData(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTitulo || !selectedLeitor) {
      toast({
        title: 'Campos incompletos',
        description: 'Selecione a obra e o leitor interessado.',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      const operatorName = profile?.full_name || 'Operador'
      await ReservasService.create(selectedTitulo, Number(selectedLeitor), operatorName)
      toast({
        title: 'Reserva confirmada!',
        description: 'Assim que um exemplar for devolvido, a fila de reservas será atendida.',
      })
      onSuccess()
      onOpenChange(false)
    } catch (err: any) {
      toast({
        title: 'Não foi possível reservar',
        description: err.message || 'Erro ao processar reserva.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <BookmarkCheck className="w-5 h-5 text-emerald-600" />
              Solicitar Reserva de Livro
            </DialogTitle>
            <DialogDescription>
              Reserve um exemplar quando todas as cópias físicas estiverem emprestadas.
            </DialogDescription>
          </DialogHeader>

          {loadingData ? (
            <div className="py-8 text-center text-slate-400 flex flex-col items-center justify-center gap-1">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
              <span className="text-xs">Carregando dados...</span>
            </div>
          ) : (
            <div className="grid gap-4 py-4">
              <div>
                <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
                  <Book className="w-3.5 h-3.5 text-emerald-600" />
                  Obra Desejada *
                </Label>
                <Select value={selectedTitulo} onValueChange={setSelectedTitulo}>
                  <SelectTrigger className="w-full text-xs">
                    <SelectValue placeholder="Selecione o livro..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {titulos.map((b) => (
                      <SelectItem key={b.id_titulo} value={b.id_titulo} className="text-xs">
                        <span className="font-semibold text-slate-800">{b.titulo_de_livro}</span>
                        <span className="text-slate-500 ml-1">({b.autor})</span>
                        <span className="text-[10px] ml-2 text-emerald-700 font-mono">
                          [{b.id_titulo}]
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
                  <User className="w-3.5 h-3.5 text-emerald-600" />
                  Leitor Solicitante *
                </Label>
                {isOperadorOrAdmin ? (
                  <Select value={selectedLeitor} onValueChange={setSelectedLeitor}>
                    <SelectTrigger className="w-full text-xs">
                      <SelectValue placeholder="Selecione o leitor..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {leitores.map((r) => (
                        <SelectItem
                          key={r.id_leitor}
                          value={String(r.id_leitor)}
                          className="text-xs"
                        >
                          <span className="font-semibold text-slate-800">{r.nome_do_leitor}</span>
                          <span className="text-slate-500 ml-2">({r.email})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="p-2.5 bg-slate-100 rounded text-xs text-slate-700 font-medium">
                    {profile?.full_name} ({profile?.email})
                  </div>
                )}
              </div>

              <div className="bg-amber-50/60 p-3 rounded-lg border border-amber-200 text-xs text-amber-900 space-y-1">
                <p className="font-semibold">Política de Fila de Espera</p>
                <p className="text-[11px] text-amber-800">
                  As reservas seguem a ordem cronológica de solicitação. Quando um exemplar for
                  devolvido, a biblioteca notificará o leitor para retirada.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={loading || !selectedTitulo || !selectedLeitor}
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar Reserva
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
