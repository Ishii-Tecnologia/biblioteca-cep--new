import React, { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TitulosService, Titulo, TituloInsert, TituloWithStats } from '@/services/titulos'
import { CategoriasService } from '@/services/categorias'
import { fetchBookByIsbn, normalizeAndValidateIsbn, formatAuthorDisplay } from '@/services/isbn'
import { AuthorCombobox } from '@/components/AuthorCombobox'
import { BarcodeScannerModal } from '@/components/BarcodeScannerModal'
import {
  Upload,
  Sparkles,
  Loader2,
  Camera,
  AlertCircle,
  CheckCircle2,
  BookOpen,
  Image as ImageIcon,
  ClipboardPaste,
  Trash2,
  User,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { uploadImageToStorage } from '@/lib/image-upload'
import { BookMetadata } from '@/services/isbn'
import { ParametrosService } from '@/services/parametros'

interface BookFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  bookToEdit?: TituloWithStats | Titulo | null
  categories?: string[]
}

export const BookFormModal: React.FC<BookFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  bookToEdit,
  categories: initialCategories,
}) => {
  const { toast } = useToast()
  const isEditing = !!bookToEdit

  const [idTitulo, setIdTitulo] = useState('')
  const [isbn, setIsbn] = useState('')
  const [tituloDeLivro, setTituloDeLivro] = useState('')
  const [autorEspiritual, setAutorEspiritual] = useState('')
  const [autorMediunico, setAutorMediunico] = useState('')
  const [autor, setAutor] = useState('')
  const [authorStructure, setAuthorStructure] = useState<'ESPIRITO_MEDIUM' | 'CONVENCIONAL'>(
    'ESPIRITO_MEDIUM',
  )
  const [editora, setEditora] = useState('')
  const [anoPublicacao, setAnoPublicacao] = useState<number | ''>('')
  const [categoria, setCategoria] = useState('')
  const [sinopse, setSinopse] = useState('')
  const [capaUrl, setCapaUrl] = useState('')
  const [vol, setVol] = useState<number | ''>('')
  const [ativo, setAtivo] = useState(true)

  // Lista dinâmica de categorias carregada do banco
  const [availableCategories, setAvailableCategories] = useState<string[]>(initialCategories || [])
  const [loadingCategories, setLoadingCategories] = useState(false)

  // Creation extra fields
  const [numExemplares, setNumExemplares] = useState(1)
  const [localizacao, setLocalizacao] = useState('Estante Geral')

  // Dynamic labels from parametros
  const [labelEspiritoMedium, setLabelEspiritoMedium] = useState('Espírito + Médium')
  const [labelConvencional, setLabelConvencional] = useState('Autor Convencional')

  const [loading, setLoading] = useState(false)
  const [loadingIsbn, setLoadingIsbn] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [isbnError, setIsbnError] = useState<string | null>(null)
  const [imageLoadError, setImageLoadError] = useState(false)
  const [isScannerOpen, setIsScannerOpen] = useState(false)

  const coverPasteBoxRef = useRef<HTMLDivElement>(null)

  // Carregar categorias dinamicamente da tabela `categorias` (e fallback) e rótulos
  useEffect(() => {
    if (isOpen) {
      ParametrosService.getByName('label_estrutura_espirito_medium', 'Espírito + Médium')
        .then(setLabelEspiritoMedium)
        .catch(() => setLabelEspiritoMedium('Espírito + Médium'))
      ParametrosService.getByName('label_estrutura_convencional', 'Autor Convencional')
        .then(setLabelConvencional)
        .catch(() => setLabelConvencional('Autor Convencional'))

      setLoadingCategories(true)
      CategoriasService.getAll()
        .then((cats) => {
          const names = cats.map((c) => c.nome.trim()).filter(Boolean)
          if (names.length > 0) {
            setAvailableCategories(names)
          } else if (initialCategories && initialCategories.length > 0) {
            setAvailableCategories(initialCategories)
          } else {
            TitulosService.getCategories().then((tCats) => {
              setAvailableCategories(tCats.length > 0 ? tCats : [])
            })
          }
        })
        .catch((err) => {
          console.error('Erro ao buscar categorias no modal:', err)
          if (initialCategories && initialCategories.length > 0) {
            setAvailableCategories(initialCategories)
          }
        })
        .finally(() => {
          setLoadingCategories(false)
        })
    }
  }, [isOpen, initialCategories])

  // Preenche formulário ao editar ou abrir
  useEffect(() => {
    if (bookToEdit) {
      setIdTitulo(bookToEdit.id_titulo)
      setIsbn(bookToEdit.isbn || '')
      setTituloDeLivro(bookToEdit.titulo_de_livro)
      setAutorEspiritual(bookToEdit.autor_espiritual || '')
      setAutorMediunico(bookToEdit.autor_mediunico || '')
      setAutor(bookToEdit.autor || '')
      const isEspMed = !!(bookToEdit.autor_espiritual || bookToEdit.autor_mediunico)
      setAuthorStructure(isEspMed ? 'ESPIRITO_MEDIUM' : 'CONVENCIONAL')
      setEditora(bookToEdit.editora || '')
      setAnoPublicacao(bookToEdit.ano_publicacao || '')
      setCategoria(bookToEdit.categoria || '')
      setSinopse(bookToEdit.sinopse || '')
      setCapaUrl(bookToEdit.capa_url || '')
      setVol(bookToEdit.vol ?? '')
      setAtivo(bookToEdit.ativo ?? true)
    } else {
      setIdTitulo('')
      setIsbn('')
      setTituloDeLivro('')
      setAutorEspiritual('')
      setAutorMediunico('')
      setAutor('')
      // Default: Espírito + Médium
      setAuthorStructure('ESPIRITO_MEDIUM')
      setEditora('')
      setAnoPublicacao('')
      const defaultCat = availableCategories.length > 0 ? availableCategories[0] : ''
      setCategoria(defaultCat)
      setSinopse('')
      setCapaUrl('')
      setVol('')
      setAtivo(true)
      setNumExemplares(1)
      setLocalizacao('Estante Geral')
    }
    setIsbnError(null)
    setImageLoadError(false)
  }, [bookToEdit, isOpen])

  // Se for novo cadastro e categoria estiver vazia quando as categorias carregarem, define a primeira categoria cadastrada
  useEffect(() => {
    if (!bookToEdit && isOpen && !categoria && availableCategories.length > 0) {
      setCategoria(availableCategories[0])
    }
  }, [availableCategories, bookToEdit, isOpen, categoria])

  // Validação dinâmica do campo ISBN
  const handleIsbnChange = (val: string) => {
    setIsbn(val)
    if (!val.trim()) {
      setIsbnError(isEditing ? null : 'ISBN é obrigatório para novos cadastros.')
      return
    }
    const validation = normalizeAndValidateIsbn(val)
    if (!validation.valid) {
      setIsbnError(validation.error || 'Formato de ISBN inválido.')
    } else {
      setIsbnError(null)
    }
  }

  // Preenchimento automático via Google Books / Open Library
  const handleFetchIsbn = async (customIsbn?: string) => {
    const targetIsbn = customIsbn || isbn
    if (!targetIsbn || !targetIsbn.trim()) {
      toast({
        title: 'ISBN em branco',
        description: 'Digite ou escaneie um ISBN para consultar.',
        variant: 'destructive',
      })
      return
    }

    const val = normalizeAndValidateIsbn(targetIsbn)
    if (!val.valid) {
      toast({
        title: 'ISBN Inválido',
        description: val.error,
        variant: 'destructive',
      })
      return
    }

    setLoadingIsbn(true)
    setIsbnError(null)
    try {
      const meta = await fetchBookByIsbn(val.isbn13)
      setIsbn(meta.isbn)
      if (meta.titulo_de_livro) setTituloDeLivro(meta.titulo_de_livro)
      if (meta.autor) {
        setAutor(meta.autor)
        if (authorStructure === 'ESPIRITO_MEDIUM') {
          // Se trouxer autor espiritual ou convencional
          if (meta.autor_espiritual) setAutorEspiritual(meta.autor_espiritual)
          if (meta.autor_mediunico) setAutorMediunico(meta.autor_mediunico)
        }
      }
      if (meta.editora) setEditora(meta.editora)
      if (meta.ano_publicacao) setAnoPublicacao(meta.ano_publicacao)
      if (meta.sinopse) setSinopse(meta.sinopse)
      if (meta.capa_url) {
        setCapaUrl(meta.capa_url)
      }
      if (meta.categoria && !categoria) setCategoria(meta.categoria)

      toast({
        title: 'Dados encontrados!',
        description: meta.capa_url
          ? `Metadados e capa preenchidos para "${meta.titulo_de_livro}".`
          : `Metadados preenchidos para "${meta.titulo_de_livro}".`,
      })
    } catch (err: any) {
      toast({
        title: 'Aviso',
        description: err.message || 'Não foram encontrados dados automáticos para este ISBN.',
        variant: 'destructive',
      })
    } finally {
      setLoadingIsbn(false)
    }
  }

  // Upload manual de imagem da capa
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingImage(true)
    setImageLoadError(false)
    try {
      const publicUrl = await uploadImageToStorage(file, 'capas')
      setCapaUrl(publicUrl)
      toast({
        title: 'Capa enviada',
        description: 'A imagem da capa foi atualizada com sucesso.',
      })
    } catch (err: any) {
      toast({
        title: 'Erro no upload',
        description: err.message || 'Não foi possível carregar a imagem.',
        variant: 'destructive',
      })
    } finally {
      setUploadingImage(false)
    }
  }

  // Tratar colar imagem da área de transferência (Ctrl+V ou botão Colar)
  const handlePasteImageFromClipboard = async (e?: React.ClipboardEvent) => {
    if (e) {
      const items = e.clipboardData?.items
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            const blob = items[i].getAsFile()
            if (blob) {
              e.preventDefault()
              await processPastedImageBlob(blob)
              return
            }
          }
        }
        const text = e.clipboardData.getData('text')
        if (
          text &&
          (text.startsWith('http://') ||
            text.startsWith('https://') ||
            text.startsWith('data:image/'))
        ) {
          setCapaUrl(text.trim())
          toast({
            title: 'URL da capa colada',
            description: 'Link da imagem aplicado com sucesso.',
          })
          return
        }
      }
    } else {
      try {
        if (navigator.clipboard && navigator.clipboard.read) {
          const clipboardItems = await navigator.clipboard.read()
          for (const item of clipboardItems) {
            const imageType = item.types.find((t) => t.startsWith('image/'))
            if (imageType) {
              const blob = await item.getType(imageType)
              await processPastedImageBlob(new File([blob], 'capa_colada.png', { type: imageType }))
              return
            }
          }
        }
        if (navigator.clipboard && navigator.clipboard.readText) {
          const text = await navigator.clipboard.readText()
          if (
            text &&
            (text.startsWith('http://') ||
              text.startsWith('https://') ||
              text.startsWith('data:image/'))
          ) {
            setCapaUrl(text.trim())
            toast({
              title: 'URL da capa colada',
              description: 'Link da imagem aplicado com sucesso.',
            })
            return
          }
        }
        toast({
          title: 'Nenhuma imagem na área de transferência',
          description: 'Copie uma imagem ou link (URL) antes de colar.',
          variant: 'destructive',
        })
      } catch (err: any) {
        toast({
          title: 'Aviso',
          description: 'Use Ctrl+V no campo ou selecione um arquivo de imagem.',
        })
      }
    }
  }

  const processPastedImageBlob = async (file: File) => {
    setUploadingImage(true)
    setImageLoadError(false)
    try {
      const publicUrl = await uploadImageToStorage(file, 'capas')
      setCapaUrl(publicUrl)
      toast({
        title: 'Imagem colada e salva!',
        description: 'A foto da capa foi salva no servidor.',
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao processar imagem colada',
        description: err.message || 'Falha ao fazer upload da imagem.',
        variant: 'destructive',
      })
    } finally {
      setUploadingImage(false)
    }
  }

  // Scanner acionado internamente dentro do modal
  const handleScanSuccess = (meta: BookMetadata) => {
    if (meta.isbn) {
      setIsbn(meta.isbn)
      handleIsbnChange(meta.isbn)
    }
    if (meta.titulo_de_livro) setTituloDeLivro(meta.titulo_de_livro)
    if (meta.autor) {
      setAutor(meta.autor)
      if (meta.autor_espiritual) {
        setAutorEspiritual(meta.autor_espiritual)
        setAuthorStructure('ESPIRITO_MEDIUM')
      }
      if (meta.autor_mediunico) {
        setAutorMediunico(meta.autor_mediunico)
        setAuthorStructure('ESPIRITO_MEDIUM')
      }
    }
    if (meta.editora) setEditora(meta.editora)
    if (meta.ano_publicacao) setAnoPublicacao(meta.ano_publicacao)
    if (meta.sinopse) setSinopse(meta.sinopse)
    if (meta.capa_url) {
      setCapaUrl(meta.capa_url)
    }
    if (meta.categoria && !categoria) setCategoria(meta.categoria)

    toast({
      title: 'Livro identificado!',
      description: meta.capa_url
        ? `Código lido e capa obtida para "${meta.titulo_de_livro || meta.isbn}".`
        : `Código lido com sucesso para "${meta.titulo_de_livro || meta.isbn}".`,
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validação de Título
    if (!tituloDeLivro.trim()) {
      toast({
        title: 'Campo obrigatório',
        description: 'Informe o título da obra.',
        variant: 'destructive',
      })
      return
    }

    const isMediumistic = authorStructure === 'ESPIRITO_MEDIUM'

    // Validação de Autoria
    if (isMediumistic) {
      if (!autorEspiritual.trim() && !autorMediunico.trim()) {
        toast({
          title: 'Autoria incompleta',
          description: `Informe ao menos o Autor Espiritual ou o Médium para a estrutura "${labelEspiritoMedium}".`,
          variant: 'destructive',
        })
        return
      }
    } else {
      if (!autor.trim()) {
        toast({
          title: 'Autor obrigatório',
          description: 'Informe o nome do autor da obra.',
          variant: 'destructive',
        })
        return
      }
    }

    // ISBN Obrigatório para NOVOS cadastros
    if (!isEditing && !isbn.trim()) {
      setIsbnError('O ISBN é obrigatório para novos cadastros.')
      toast({
        title: 'ISBN Obrigatório',
        description: 'O campo ISBN é obrigatório para novos cadastros no acervo.',
        variant: 'destructive',
      })
      return
    }

    // Se ISBN foi preenchido, validar rigorosamente
    if (isbn.trim()) {
      const val = normalizeAndValidateIsbn(isbn)
      if (!val.valid) {
        setIsbnError(val.error || 'ISBN inválido.')
        toast({
          title: 'ISBN Inválido',
          description: val.error,
          variant: 'destructive',
        })
        return
      }
    }

    setLoading(true)

    try {
      const finalAutorEspiritual = isMediumistic ? autorEspiritual.trim() : null
      const finalAutorMediunico = isMediumistic ? autorMediunico.trim() : null
      const finalAutorGeral = !isMediumistic ? autor.trim() : ''

      const finalUnifiedAuthor = formatAuthorDisplay(
        finalAutorEspiritual,
        finalAutorMediunico,
        finalAutorGeral,
      )

      const normalizedIsbnValue = isbn.trim()
        ? normalizeAndValidateIsbn(isbn).isbn13
        : isEditing
          ? bookToEdit?.isbn || null
          : null

      if (isEditing && bookToEdit) {
        await TitulosService.update(bookToEdit.id_titulo, {
          titulo_de_livro: tituloDeLivro.trim(),
          autor: finalUnifiedAuthor,
          autor_espiritual: finalAutorEspiritual,
          autor_mediunico: finalAutorMediunico,
          editora: editora.trim() || null,
          ano_publicacao: anoPublicacao === '' ? null : Number(anoPublicacao),
          categoria: categoria || 'Geral',
          sinopse: sinopse.trim() || null,
          capa_url: capaUrl.trim() || null,
          vol: vol === '' ? 0 : Number(vol),
          ativo: ativo,
          isbn: normalizedIsbnValue,
        })

        toast({
          title: 'Obra atualizada',
          description: `"${tituloDeLivro}" foi atualizado com sucesso.`,
        })
      } else {
        const payload: TituloInsert = {
          id_titulo: idTitulo.trim().toUpperCase(),
          titulo_de_livro: tituloDeLivro.trim(),
          autor: finalUnifiedAuthor,
          autor_espiritual: finalAutorEspiritual,
          autor_mediunico: finalAutorMediunico,
          editora: editora.trim() || null,
          ano_publicacao: anoPublicacao === '' ? null : Number(anoPublicacao),
          categoria: categoria || 'Geral',
          sinopse: sinopse.trim() || null,
          capa_url: capaUrl.trim() || null,
          vol: vol === '' ? 0 : Number(vol),
          ativo: ativo,
          isbn: normalizedIsbnValue,
        }

        await TitulosService.create(payload, numExemplares, localizacao)

        toast({
          title: 'Obra cadastrada',
          description: `"${tituloDeLivro}" foi adicionado com ${numExemplares} exemplar(es).`,
        })
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar obra',
        description: err.message || 'Ocorreu um erro ao salvar o registro no banco.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-6">
          <DialogHeader className="pb-2 border-b">
            <DialogTitle className="text-xl flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-600" />
              {isEditing ? 'Editar Livro no Acervo' : 'Novo Livro no Acervo'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {/* 1. SEÇÃO DE FOTO DA CAPA NO INÍCIO COM ÁREA PARA COLAR (Ctrl+V) */}
            <div
              ref={coverPasteBoxRef}
              onPaste={handlePasteImageFromClipboard}
              tabIndex={0}
              className="p-3.5 rounded-xl border-2 border-dashed border-slate-200 hover:border-emerald-500/50 bg-slate-50/70 dark:bg-slate-900/30 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            >
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                {/* Preview da Capa */}
                <div className="w-24 h-32 rounded-lg border border-slate-200 bg-white overflow-hidden shrink-0 shadow-xs relative flex items-center justify-center group">
                  {capaUrl && !imageLoadError ? (
                    <>
                      <img
                        src={capaUrl}
                        alt="Capa do Livro"
                        className="w-full h-full object-cover"
                        onError={() => setImageLoadError(true)}
                        onLoad={() => setImageLoadError(false)}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setCapaUrl('')
                          setImageLoadError(false)
                        }}
                        title="Remover capa"
                        className="absolute top-1 right-1 p-1 rounded-md bg-black/60 text-white hover:bg-rose-600 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400 p-2 text-center">
                      <ImageIcon className="w-8 h-8 mb-1 stroke-1" />
                      <span className="text-[10px] leading-tight">
                        {imageLoadError ? 'Falha ao carregar' : 'Sem Capa'}
                      </span>
                    </div>
                  )}
                  {uploadingImage && (
                    <div className="absolute inset-0 bg-white/80 dark:bg-black/80 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                    </div>
                  )}
                </div>

                {/* Inputs e Ações de Imagem */}
                <div className="flex-1 min-w-0 space-y-2 w-full">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-emerald-600" />
                      Foto da Capa do Livro
                    </Label>
                    {capaUrl && !imageLoadError && (
                      <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Imagem vinculada
                      </span>
                    )}
                    {capaUrl && imageLoadError && (
                      <span className="text-[11px] text-amber-600 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Link inválido / inacessível
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-500">
                    A capa é preenchida automaticamente com o ISBN. Você também pode colar com{' '}
                    <strong>Ctrl+V</strong>, colar uma URL ou fazer upload.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      value={capaUrl}
                      onChange={(e) => {
                        setCapaUrl(e.target.value)
                        setImageLoadError(false)
                      }}
                      placeholder="https://... ou cole com Ctrl+V"
                      className="text-xs font-mono bg-white flex-1"
                    />

                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handlePasteImageFromClipboard()}
                        title="Colar imagem ou link da área de transferência"
                        className="text-xs h-8 gap-1 border-slate-300 hover:bg-slate-100"
                      >
                        <ClipboardPaste className="w-3.5 h-3.5 text-emerald-600" />
                        Colar Imagem
                      </Button>

                      <Label
                        htmlFor="cover-camera-top"
                        className="cursor-pointer inline-flex items-center justify-center gap-1 px-2.5 h-8 text-xs border border-slate-300 rounded-md bg-white hover:bg-slate-100 text-slate-700 shrink-0"
                        title="Fotografar capa com a câmera do dispositivo"
                      >
                        {uploadingImage ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Camera className="w-3.5 h-3.5 text-emerald-600" />
                        )}
                        Câmera
                      </Label>
                      <input
                        id="cover-camera-top"
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleImageUpload}
                        className="hidden"
                        disabled={uploadingImage}
                      />

                      <Label
                        htmlFor="cover-upload-top"
                        className="cursor-pointer inline-flex items-center justify-center gap-1 px-2.5 h-8 text-xs border border-slate-300 rounded-md bg-white hover:bg-slate-100 text-slate-700 shrink-0"
                      >
                        {uploadingImage ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Upload className="w-3.5 h-3.5 text-emerald-600" />
                        )}
                        Upload
                      </Label>
                      <input
                        id="cover-upload-top"
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        disabled={uploadingImage}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. ISBN COM BOTÃO "LER CÓDIGO DE BARRAS" INTERNO */}
            <div className="space-y-1.5 p-3.5 bg-muted/30 rounded-xl border border-border">
              <div className="flex items-center justify-between">
                <Label htmlFor="isbn" className="font-semibold text-xs flex items-center gap-1.5">
                  ISBN (10 ou 13 dígitos)
                  <span className="text-rose-500 font-bold">*</span>
                </Label>
                <span className="text-[11px] text-muted-foreground">
                  Obrigatório para novos cadastros
                </span>
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="isbn"
                    value={isbn}
                    onChange={(e) => handleIsbnChange(e.target.value)}
                    placeholder="Ex: 9788573286885 ou 8573286889"
                    className={`text-sm font-mono ${isbnError ? 'border-rose-500 ring-1 ring-rose-500' : ''}`}
                  />
                  {isbn && !isbnError && (
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-emerald-600">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  )}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsScannerOpen(true)}
                  title="Ler código de barras via câmera para preencher dados"
                  className="px-2.5 shrink-0 gap-1.5 border-emerald-600/40 text-emerald-700 hover:bg-emerald-50"
                >
                  <Camera className="w-4 h-4" />
                  <span className="hidden sm:inline text-xs font-medium">Ler Código de Barras</span>
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => handleFetchIsbn()}
                  disabled={loadingIsbn || !isbn.trim()}
                  className="gap-1.5 shrink-0"
                >
                  {loadingIsbn ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-amber-500" />
                  )}
                  {loadingIsbn ? 'Consultando...' : 'Preencher'}
                </Button>
              </div>

              {isbnError && (
                <div className="flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 mt-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{isbnError}</span>
                </div>
              )}
            </div>

            {/* 3. TÍTULO DA OBRA */}
            <div className="space-y-1.5">
              <Label htmlFor="titulo" className="text-xs font-semibold">
                Título da Obra <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="titulo"
                value={tituloDeLivro}
                onChange={(e) => setTituloDeLivro(e.target.value)}
                placeholder="Ex: Nosso Lar, O Evangelho Segundo o Espiritismo..."
                className="text-sm font-medium"
                required
              />
            </div>

            {/* 4. ESTRUTURA DE AUTORIA: DROPDOWN COM "ESPÍRITO + MÉDIUM" DEFAULT NA COR VERDE */}
            <div className="p-3.5 rounded-xl border border-border bg-card space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <Label
                    htmlFor="author-structure-select"
                    className="text-xs font-semibold text-slate-900"
                  >
                    Estrutura de Autoria
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Selecione o formato de autoria da obra para preenchimento dos campos
                    correspondentes.
                  </p>
                </div>

                <div className="w-full sm:w-56">
                  <Select
                    value={authorStructure}
                    onValueChange={(val: 'ESPIRITO_MEDIUM' | 'CONVENCIONAL') =>
                      setAuthorStructure(val)
                    }
                  >
                    <SelectTrigger
                      id="author-structure-select"
                      className={`text-xs font-semibold border ${
                        authorStructure === 'ESPIRITO_MEDIUM'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-800 hover:bg-emerald-100/80 focus:ring-emerald-500'
                          : 'border-slate-300 bg-slate-50 text-slate-800 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        {authorStructure === 'ESPIRITO_MEDIUM' ? (
                          <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        )}
                        <SelectValue />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        value="ESPIRITO_MEDIUM"
                        className="text-xs font-semibold text-emerald-700 focus:bg-emerald-50 focus:text-emerald-800"
                      >
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{labelEspiritoMedium} (Padrão)</span>
                        </div>
                      </SelectItem>
                      <SelectItem
                        value="CONVENCIONAL"
                        className="text-xs font-medium text-slate-700"
                      >
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-500" />
                          <span>{labelConvencional}</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* CAMPOS DE AUTOR: ALINHAMENTO DAS LABELS E DOS INPUTS EM 2 COLUNAS IGUAIS */}
              {authorStructure === 'ESPIRITO_MEDIUM' ? (
                <div className="pt-2 border-t border-slate-100">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                    {/* Coluna 1: Autor Espiritual */}
                    <div className="space-y-1.5 flex flex-col justify-start">
                      <Label className="text-xs font-medium text-slate-800 flex items-center gap-1 h-5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Autor Espiritual (Espírito)</span>
                      </Label>
                      <AuthorCombobox
                        value={autorEspiritual}
                        onChange={(name) => setAutorEspiritual(name)}
                        authorType="ESPIRITO"
                        isSpirit={true}
                        placeholder="Ex: André Luiz, Emmanuel, Joanna..."
                      />
                    </div>

                    {/* Coluna 2: Médium / Psicografia */}
                    <div className="space-y-1.5 flex flex-col justify-start">
                      <Label className="text-xs font-medium text-slate-800 flex items-center gap-1 h-5">
                        <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>Médium / Psicografia</span>
                      </Label>
                      <AuthorCombobox
                        value={autorMediunico}
                        onChange={(name) => setAutorMediunico(name)}
                        authorType="MEDIUM"
                        placeholder="Ex: Chico Xavier, Divaldo Franco..."
                      />
                    </div>
                  </div>

                  {(autorEspiritual || autorMediunico) && (
                    <div className="mt-3 text-xs text-muted-foreground bg-emerald-50/60 border border-emerald-100 p-2.5 rounded-lg">
                      Exibição formatada:{' '}
                      <strong className="text-emerald-950 font-semibold">
                        {formatAuthorDisplay(autorEspiritual, autorMediunico)}
                      </strong>
                    </div>
                  )}
                </div>
              ) : (
                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  <Label className="text-xs font-medium text-slate-800 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    <span>Autor(es) da Obra</span> <span className="text-rose-500">*</span>
                  </Label>
                  <AuthorCombobox
                    value={autor}
                    onChange={(name) => setAutor(name)}
                    authorType="ENCARNADO"
                    placeholder="Ex: Allan Kardec, Gabriel Delanne, Léon Denis..."
                  />
                </div>
              )}
            </div>

            {/* 5. LINHA: CATEGORIA, EDITORA, ANO */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Categoria</Label>
                  {loadingCategories && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Loader2 className="w-2.5 h-2.5 animate-spin" /> Carregando...
                    </span>
                  )}
                </div>
                <Select value={categoria} onValueChange={setCategoria}>
                  <SelectTrigger className="text-sm bg-white">
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {availableCategories.length === 0 ? (
                      <SelectItem value="Geral">Geral</SelectItem>
                    ) : (
                      <>
                        {availableCategories.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                        {categoria && !availableCategories.includes(categoria) && (
                          <SelectItem value={categoria}>{categoria}</SelectItem>
                        )}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Editora</Label>
                <Input
                  value={editora}
                  onChange={(e) => setEditora(e.target.value)}
                  placeholder="Ex: FEB, IDE, EME..."
                  className="text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Ano de Publicação</Label>
                <Input
                  type="number"
                  value={anoPublicacao}
                  onChange={(e) =>
                    setAnoPublicacao(e.target.value === '' ? '' : parseInt(e.target.value, 10))
                  }
                  placeholder="Ex: 2021"
                  className="text-sm"
                  min={1800}
                  max={2100}
                />
              </div>
            </div>

            {/* 6. LINHA: VOLUME E CÓDIGO INTERNO */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Volume / Tomo (Opcional)</Label>
                <Input
                  type="number"
                  value={vol}
                  onChange={(e) =>
                    setVol(e.target.value === '' ? '' : parseInt(e.target.value, 10))
                  }
                  placeholder="Ex: 1"
                  className="text-sm"
                  min={0}
                />
              </div>

              {!isEditing ? (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Código do Livro (Opcional)</Label>
                  <Input
                    value={idTitulo}
                    onChange={(e) => setIdTitulo(e.target.value.toUpperCase())}
                    placeholder="Gerado automaticamente (ex: AL-104)"
                    className="text-sm font-mono uppercase"
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Código Interno</Label>
                  <Input value={idTitulo} disabled className="text-sm font-mono bg-muted" />
                </div>
              )}
            </div>

            {/* 7. SINOPSE */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Sinopse / Descrição</Label>
              <Textarea
                value={sinopse}
                onChange={(e) => setSinopse(e.target.value)}
                placeholder="Breve resumo sobre os temas tratados na obra..."
                className="text-sm resize-none"
                rows={2}
              />
            </div>

            {/* 8. EXEMPLARES INICIAIS (APENAS CRIAÇÃO) */}
            {!isEditing && (
              <div className="p-3.5 bg-muted/40 rounded-xl border border-border grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Quantidade Inicial de Exemplares</Label>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={numExemplares}
                    onChange={(e) => setNumExemplares(parseInt(e.target.value, 10) || 1)}
                    className="text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Localização Física Padrão</Label>
                  <Input
                    value={localizacao}
                    onChange={(e) => setLocalizacao(e.target.value)}
                    placeholder="Ex: Estante 1, Gaveta A"
                    className="text-sm"
                  />
                </div>
              </div>
            )}

            <DialogFooter className="pt-4 border-t gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {isEditing ? 'Salvar Alterações' : 'Cadastrar Livro'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <BarcodeScannerModal
        open={isScannerOpen}
        onOpenChange={setIsScannerOpen}
        onBookFound={handleScanSuccess}
      />
    </>
  )
}
