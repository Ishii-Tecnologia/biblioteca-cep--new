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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { TitulosService, Titulo } from '@/services/titulos'
import { CategoriasService, Categoria } from '@/services/categorias'
import { useToast } from '@/hooks/use-toast'
import {
  Sparkles,
  Loader2,
  BookPlus,
  RefreshCw,
  Upload,
  Image as ImageIcon,
  X,
  ClipboardPaste,
} from 'lucide-react'
import { uploadImageToStorage } from '@/lib/image-upload'

interface BookFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookToEdit?: Titulo | null
  onSuccess: () => void
}

export function BookFormModal({ open, onOpenChange, bookToEdit, onSuccess }: BookFormModalProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [generatingId, setGeneratingId] = useState(false)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [categoriesList, setCategoriesList] = useState<Categoria[]>([])

  useEffect(() => {
    if (open) {
      CategoriasService.getAll()
        .then((cats) => setCategoriesList(cats))
        .catch(() => {})
    }
  }, [open])

  const [formData, setFormData] = useState({
    id_titulo: '',
    titulo_de_livro: '',
    autor: '',
    editora: '',
    ano_publicacao: new Date().getFullYear(),
    isbn: '',
    categoria: 'Geral',
    sinopse: '',
    vol: 0,
    capa_url: '',
    exemplaresIniciais: 1,
    localizacao: 'Estante Geral',
  })

  useEffect(() => {
    if (bookToEdit) {
      setFormData({
        id_titulo: bookToEdit.id_titulo,
        titulo_de_livro: bookToEdit.titulo_de_livro,
        autor: bookToEdit.autor,
        editora: bookToEdit.editora || '',
        ano_publicacao: bookToEdit.ano_publicacao || new Date().getFullYear(),
        isbn: bookToEdit.isbn || '',
        categoria: bookToEdit.categoria || 'Geral',
        sinopse: bookToEdit.sinopse || '',
        vol: bookToEdit.vol || 0,
        capa_url: bookToEdit.capa_url || '',
        exemplaresIniciais: 0,
        localizacao: '',
      })
      setCoverPreview(bookToEdit.capa_url || null)
      setCoverFile(null)
    } else {
      setFormData({
        id_titulo: '',
        titulo_de_livro: '',
        autor: '',
        editora: '',
        ano_publicacao: new Date().getFullYear(),
        isbn: '',
        categoria: 'Literatura Brasileira',
        sinopse: '',
        vol: 0,
        capa_url: '',
        exemplaresIniciais: 1,
        localizacao: 'Estante A-1',
      })
      setCoverPreview(null)
      setCoverFile(null)
    }
  }, [bookToEdit, open])

  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setCoverFile(file)
      const reader = new FileReader()
      reader.onload = (ev) => {
        setCoverPreview(ev.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.type.startsWith('image/')) {
        const blob = item.getAsFile()
        if (blob) {
          e.preventDefault()
          const pastedFile = new File([blob], `pasted-image-${Date.now()}.png`, {
            type: blob.type,
          })
          setCoverFile(pastedFile)
          const reader = new FileReader()
          reader.onload = (ev) => {
            setCoverPreview(ev.target?.result as string)
          }
          reader.readAsDataURL(pastedFile)
          toast({
            title: 'Imagem colada!',
            description: 'Capa do livro colada com sucesso da área de transferência.',
          })
          break
        }
      }
    }
  }

  const handleRemoveCover = () => {
    setCoverFile(null)
    setCoverPreview(null)
    setFormData((prev) => ({ ...prev, capa_url: '' }))
  }

  const handleGenerateCode = async () => {
    if (!formData.autor.trim()) {
      toast({
        title: 'Informe o autor',
        description: 'Digite o nome do autor para gerar o código padronizado (Ex: MC-001).',
        variant: 'destructive',
      })
      return
    }
    setGeneratingId(true)
    try {
      const code = await TitulosService.generateId(formData.autor, formData.titulo_de_livro)
      setFormData((prev) => ({ ...prev, id_titulo: code }))
    } catch (e: any) {
      toast({ title: 'Erro ao gerar código', description: e.message, variant: 'destructive' })
    } finally {
      setGeneratingId(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.titulo_de_livro.trim() || !formData.autor.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Título e Autor são obrigatórios.',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      let finalCapaUrl = formData.capa_url.trim() || null

      if (coverFile) {
        finalCapaUrl = await uploadImageToStorage(coverFile, 'capas', {
          maxWidth: 800,
          maxHeight: 1200,
          quality: 0.8,
          outputFormat: 'image/jpeg',
        })
      }

      if (bookToEdit) {
        await TitulosService.update(bookToEdit.id_titulo, {
          titulo_de_livro: formData.titulo_de_livro,
          autor: formData.autor,
          editora: formData.editora || null,
          ano_publicacao: formData.ano_publicacao ? Number(formData.ano_publicacao) : null,
          isbn: formData.isbn || null,
          categoria: formData.categoria || null,
          sinopse: formData.sinopse?.trim() || null,
          vol: Number(formData.vol) || 0,
          capa_url: finalCapaUrl,
        })
        toast({ title: 'Sucesso', description: 'Livro atualizado com sucesso!' })
      } else {
        await TitulosService.create(
          {
            id_titulo: formData.id_titulo || undefined,
            titulo_de_livro: formData.titulo_de_livro,
            autor: formData.autor,
            editora: formData.editora || null,
            ano_publicacao: formData.ano_publicacao ? Number(formData.ano_publicacao) : null,
            isbn: formData.isbn || null,
            categoria: formData.categoria || null,
            sinopse: formData.sinopse?.trim() || null,
            vol: Number(formData.vol) || 0,
            capa_url: finalCapaUrl,
          },
          formData.exemplaresIniciais,
          formData.localizacao,
        )
        toast({ title: 'Sucesso', description: 'Novo livro cadastrado com sucesso!' })
      }
      onSuccess()
      onOpenChange(false)
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar livro',
        description: err.message || 'Ocorreu um erro ao processar a requisição.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <BookPlus className="w-5 h-5 text-emerald-600" />
              {bookToEdit ? 'Editar Obra do Acervo' : 'Cadastrar Novo Livro'}
            </DialogTitle>
            <DialogDescription>
              {bookToEdit
                ? 'Atualize os dados bibliográficos deste título.'
                : 'Insira os dados do livro e a quantidade inicial de cópias físicas (exemplares).'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Upload de Capa */}
            <div
              onPaste={handlePaste}
              tabIndex={0}
              className="flex flex-col sm:flex-row items-center gap-4 p-3 bg-slate-50 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all cursor-default"
              title="Clique aqui e pressione Ctrl+V / Cmd+V para colar uma imagem da área de transferência"
            >
              <div className="w-20 h-28 bg-slate-200 rounded border border-slate-300 overflow-hidden flex items-center justify-center shrink-0 shadow-xs">
                {coverPreview ? (
                  <img
                    src={coverPreview}
                    alt="Capa do livro"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400 p-2 text-center">
                    <ImageIcon className="w-6 h-6 mb-1" />
                    <span className="text-[10px] leading-tight font-medium">Sem capa</span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5 flex-1 text-center sm:text-left">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-slate-800">
                    Imagem da Capa do Livro
                  </Label>
                  <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-slate-400">
                    <ClipboardPaste className="w-3 h-3" /> Ctrl+V aceito
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Selecione um arquivo ou cole (Ctrl+V) diretamente aqui. Comprimida via Canvas e
                  salva no Storage.
                </p>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 shadow-xs">
                    <Upload className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Upload de Imagem</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/jpg"
                      onChange={handleCoverSelect}
                      className="hidden"
                      disabled={loading}
                    />
                  </label>
                  {coverPreview && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveCover}
                      className="h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2"
                    >
                      <X className="w-3.5 h-3.5 mr-1" />
                      Remover Capa
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <Label htmlFor="titulo_de_livro" className="text-xs font-semibold text-slate-700">
                  Título do Livro *
                </Label>
                <Input
                  id="titulo_de_livro"
                  required
                  placeholder="Ex: Dom Casmurro"
                  value={formData.titulo_de_livro}
                  onChange={(e) => setFormData({ ...formData, titulo_de_livro: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div>
                <Label
                  htmlFor="id_titulo"
                  className="text-xs font-semibold text-slate-700 flex items-center justify-between"
                >
                  <span>Código (ID)</span>
                  {!bookToEdit && (
                    <button
                      type="button"
                      onClick={handleGenerateCode}
                      disabled={generatingId}
                      className="text-[11px] text-emerald-600 hover:text-emerald-700 flex items-center gap-0.5 font-medium"
                    >
                      {generatingId ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                      Auto
                    </button>
                  )}
                </Label>
                <Input
                  id="id_titulo"
                  disabled={!!bookToEdit}
                  placeholder="Ex: MC-001"
                  value={formData.id_titulo}
                  onChange={(e) =>
                    setFormData({ ...formData, id_titulo: e.target.value.toUpperCase() })
                  }
                  className="mt-1 font-mono uppercase"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="autor" className="text-xs font-semibold text-slate-700">
                  Autor(a) *
                </Label>
                <Input
                  id="autor"
                  required
                  placeholder="Ex: Machado de Assis"
                  value={formData.autor}
                  onChange={(e) => setFormData({ ...formData, autor: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="editora" className="text-xs font-semibold text-slate-700">
                  Editora
                </Label>
                <Input
                  id="editora"
                  placeholder="Ex: Companhia das Letras"
                  value={formData.editora}
                  onChange={(e) => setFormData({ ...formData, editora: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="categoria" className="text-xs font-semibold text-slate-700">
                  Categoria / Gênero
                </Label>
                <Input
                  id="categoria"
                  list="categorias-datalist"
                  placeholder="Ex: Doutrina Espírita, Mediunidade"
                  value={formData.categoria}
                  onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                  className="mt-1"
                />
                <datalist id="categorias-datalist">
                  {categoriesList.map((cat) => (
                    <option key={cat.id} value={cat.nome} />
                  ))}
                </datalist>
              </div>

              <div>
                <Label htmlFor="ano_publicacao" className="text-xs font-semibold text-slate-700">
                  Ano de Publicação
                </Label>
                <Input
                  id="ano_publicacao"
                  type="number"
                  placeholder="Ex: 2020"
                  value={formData.ano_publicacao || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, ano_publicacao: Number(e.target.value) })
                  }
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="vol" className="text-xs font-semibold text-slate-700">
                  Volume / Edição
                </Label>
                <Input
                  id="vol"
                  type="number"
                  min={0}
                  placeholder="0 se único"
                  value={formData.vol || ''}
                  onChange={(e) => setFormData({ ...formData, vol: Number(e.target.value) })}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="isbn" className="text-xs font-semibold text-slate-700">
                ISBN (opcional)
              </Label>
              <Input
                id="isbn"
                placeholder="Ex: 978-85-359-0277-8"
                value={formData.isbn}
                onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
                className="mt-1 font-mono text-xs"
              />
            </div>

            <div>
              <Label htmlFor="sinopse" className="text-xs font-semibold text-slate-700">
                Sinopse
              </Label>
              <Textarea
                id="sinopse"
                rows={3}
                placeholder="Resumo ou descrição do enredo da obra..."
                value={formData.sinopse}
                onChange={(e) => setFormData({ ...formData, sinopse: e.target.value })}
                className="mt-1 resize-none text-xs"
              />
            </div>

            {!bookToEdit && (
              <div className="bg-emerald-50/60 p-3.5 rounded-lg border border-emerald-100 space-y-3">
                <p className="text-xs font-semibold text-emerald-900 flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
                  Gerar Cópias Físicas Iniciais (Exemplares)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label
                      htmlFor="exemplaresIniciais"
                      className="text-xs font-medium text-emerald-800"
                    >
                      Quantidade de Cópias
                    </Label>
                    <Input
                      id="exemplaresIniciais"
                      type="number"
                      min={1}
                      max={50}
                      value={formData.exemplaresIniciais}
                      onChange={(e) =>
                        setFormData({ ...formData, exemplaresIniciais: Number(e.target.value) })
                      }
                      className="mt-1 bg-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="localizacao" className="text-xs font-medium text-emerald-800">
                      Localização na Biblioteca
                    </Label>
                    <Input
                      id="localizacao"
                      placeholder="Ex: Estante B - Prateleira 2"
                      value={formData.localizacao}
                      onChange={(e) => setFormData({ ...formData, localizacao: e.target.value })}
                      className="mt-1 bg-white"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

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
              disabled={loading}
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {bookToEdit ? 'Salvar Alterações' : 'Cadastrar Livro'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
