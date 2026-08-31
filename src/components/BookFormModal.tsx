import React, { useState, useEffect } from 'react'
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
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TitulosService, Titulo, TituloInsert, TituloWithStats } from '@/services/titulos'
import { fetchBookByIsbn, normalizeAndValidateIsbn, formatAuthorDisplay } from '@/services/isbn'
import { AuthorCombobox } from '@/components/AuthorCombobox'
import { BarcodeScannerModal } from '@/components/BarcodeScannerModal'
import {
  Upload,
  Sparkles,
  Loader2,
  Camera,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  BookOpen,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { uploadImageToStorage } from '@/lib/image-upload'
import { BookMetadata } from '@/services/isbn'

interface BookFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  bookToEdit?: TituloWithStats | Titulo | null
  categories: string[]
}

export const BookFormModal: React.FC<BookFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  bookToEdit,
  categories,
}) => {
  const { toast } = useToast()
  const isEditing = !!bookToEdit

  const [idTitulo, setIdTitulo] = useState('')
  const [isbn, setIsbn] = useState('')
  const [tituloDeLivro, setTituloDeLivro] = useState('')
  const [autorEspiritual, setAutorEspiritual] = useState('')
  const [autorMediunico, setAutorMediunico] = useState('')
  const [autor, setAutor] = useState('')
  const [isMediumistic, setIsMediumistic] = useState(false)
  const [editora, setEditora] = useState('')
  const [anoPublicacao, setAnoPublicacao] = useState<number | ''>('')
  const [categoria, setCategoria] = useState('')
  const [sinopse, setSinopse] = useState('')
  const [capaUrl, setCapaUrl] = useState('')
  const [vol, setVol] = useState<number | ''>('')
  const [ativo, setAtivo] = useState(true)

  // Creation extra fields
  const [numExemplares, setNumExemplares] = useState(1)
  const [localizacao, setLocalizacao] = useState('Estante Geral')

  const [loading, setLoading] = useState(false)
  const [loadingIsbn, setLoadingIsbn] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [isbnError, setIsbnError] = useState<string | null>(null)
  const [isScannerOpen, setIsScannerOpen] = useState(false)

  // Preenche formulário ao editar ou abrir
  useEffect(() => {
    if (bookToEdit) {
      setIdTitulo(bookToEdit.id_titulo)
      setIsbn(bookToEdit.isbn || '')
      setTituloDeLivro(bookToEdit.titulo_de_livro)
      setAutorEspiritual(bookToEdit.autor_espiritual || '')
      setAutorMediunico(bookToEdit.autor_mediunico || '')
      setAutor(bookToEdit.autor || '')
      setIsMediumistic(!!(bookToEdit.autor_espiritual || bookToEdit.autor_mediunico))
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
      setIsMediumistic(false)
      setEditora('')
      setAnoPublicacao('')
      setCategoria(categories[0] || 'Geral')
      setSinopse('')
      setCapaUrl('')
      setVol('')
      setAtivo(true)
      setNumExemplares(1)
      setLocalizacao('Estante Geral')
    }
    setIsbnError(null)
  }, [bookToEdit, categories, isOpen])

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
        if (!isMediumistic) {
          setAutorEspiritual('')
          setAutorMediunico('')
        }
      }
      if (meta.editora) setEditora(meta.editora)
      if (meta.ano_publicacao) setAnoPublicacao(meta.ano_publicacao)
      if (meta.sinopse) setSinopse(meta.sinopse)
      if (meta.capa_url && !capaUrl) setCapaUrl(meta.capa_url)
      if (meta.categoria && !categoria) setCategoria(meta.categoria)

      toast({
        title: 'Dados encontrados!',
        description: `Metadados preenchidos para "${meta.titulo_de_livro}".`,
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

  const handleScanSuccess = (meta: BookMetadata) => {
    if (meta.isbn) {
      setIsbn(meta.isbn)
      handleIsbnChange(meta.isbn)
    }
    if (meta.titulo_de_livro) setTituloDeLivro(meta.titulo_de_livro)
    if (meta.autor) {
      setAutor(meta.autor)
    }
    if (meta.editora) setEditora(meta.editora)
    if (meta.ano_publicacao) setAnoPublicacao(meta.ano_publicacao)
    if (meta.sinopse) setSinopse(meta.sinopse)
    if (meta.capa_url && !capaUrl) setCapaUrl(meta.capa_url)
    if (meta.categoria && !categoria) setCategoria(meta.categoria)
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

    // Validação de Autoria (F-04 e F-06)
    if (isMediumistic) {
      if (!autorEspiritual.trim() && !autorMediunico.trim()) {
        toast({
          title: 'Autoria incompleta',
          description: 'Informe ao menos o Autor Espiritual ou o Médium.',
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

    // F-09: ISBN Obrigatório para NOVOS cadastros (Decisão de Produto)
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              {isEditing ? 'Editar Livro no Acervo' : 'Novo Livro no Acervo'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {/* ISBN com busca automática e leitor de código de barras */}
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
                  title="Escanear com a câmera ou leitor"
                  className="px-2.5 shrink-0"
                >
                  <Camera className="w-4 h-4" />
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

            {/* Título da Obra */}
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

            {/* Separador de Autoria Espírita / Convencional (F-04 e F-06) */}
            <div className="p-3.5 rounded-xl border border-border bg-card space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-semibold">Estrutura de Autoria</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Ative caso a obra possua autor espiritual (espírito) psicografado por médium
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">
                    {isMediumistic ? 'Espírito + Médium' : 'Autor Convencional'}
                  </span>
                  <Switch
                    checked={isMediumistic}
                    onCheckedChange={(checked) => setIsMediumistic(checked)}
                  />
                </div>
              </div>

              {isMediumistic ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      Autor Espiritual (Espírito)
                    </Label>
                    <AuthorCombobox
                      value={autorEspiritual}
                      onChange={(name) => setAutorEspiritual(name)}
                      authorType="ESPIRITO"
                      isSpirit={true}
                      placeholder="Ex: André Luiz, Emmanuel, Joanna..."
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Médium / Psicografia</Label>
                    <AuthorCombobox
                      value={autorMediunico}
                      onChange={(name) => setAutorMediunico(name)}
                      authorType="MEDIUM"
                      placeholder="Ex: Chico Xavier, Divaldo Franco..."
                    />
                  </div>

                  {(autorEspiritual || autorMediunico) && (
                    <div className="col-span-full text-xs text-muted-foreground bg-muted/50 p-2 rounded-md">
                      Exibição formatada:{' '}
                      <strong className="text-foreground">
                        {formatAuthorDisplay(autorEspiritual, autorMediunico)}
                      </strong>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5 pt-1">
                  <Label className="text-xs font-medium">
                    Autor(es) da Obra <span className="text-rose-500">*</span>
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

            {/* Linha: Categoria, Editora, Ano */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Categoria</Label>
                <Select value={categoria} onValueChange={setCategoria}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                    {!categories.includes('Geral') && <SelectItem value="Geral">Geral</SelectItem>}
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

            {/* Linha: Volume e Código Interno (se edição) */}
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

            {/* Capa e Sinopse */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center justify-between">
                  <span>URL da Capa ou Foto</span>
                  {capaUrl && (
                    <span className="text-[11px] text-emerald-600 font-normal">
                      ✓ Imagem vinculada
                    </span>
                  )}
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={capaUrl}
                    onChange={(e) => setCapaUrl(e.target.value)}
                    placeholder="https://... ou faça upload"
                    className="text-sm flex-1 font-mono text-xs"
                  />
                  <Label
                    htmlFor="cover-upload"
                    className="cursor-pointer inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs border rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 shrink-0"
                  >
                    {uploadingImage ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    Upload
                  </Label>
                  <input
                    id="cover-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={uploadingImage}
                  />
                </div>
              </div>

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
            </div>

            {/* Exemplares iniciais (apenas na criação) */}
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
              <Button type="submit" disabled={loading} className="gap-2">
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
