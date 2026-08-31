import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { TitulosService, TituloWithStats, Titulo, TotaisAcervo } from '@/services/titulos'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  BookOpen,
  Search,
  PlusCircle,
  Layers,
  Edit2,
  Trash2,
  BookmarkCheck,
  Repeat,
  Loader2,
  Filter,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  UploadCloud,
  ZoomIn,
  Wrench,
  Library,
  Layers2,
  Sparkles,
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { useIsMobile } from '@/hooks/use-mobile'
import { BookFormModal } from '@/components/BookFormModal'
import { BarcodeScannerModal } from '@/components/BarcodeScannerModal'
import { BookMetadata } from '@/services/isbn'
import { CopiesModal } from '@/components/CopiesModal'
import { LoanModal } from '@/components/LoanModal'
import { ReserveModal } from '@/components/ReserveModal'
import { CsvImportModal } from '@/components/CsvImportModal'
import { BookCoverLightboxModal } from '@/components/BookCoverLightboxModal'
import { ConfirmModal } from '@/components/ConfirmModal'
import { useToast } from '@/hooks/use-toast'
import { useHeaderCounters } from '@/hooks/use-header-counters'

interface BookSinopseProps {
  sinopse: string
}

function BookSinopse({ sinopse }: BookSinopseProps) {
  const isMobile = useIsMobile()
  const [expanded, setExpanded] = useState(false)

  if (isMobile) {
    return (
      <div className="space-y-1">
        <p
          onClick={() => setExpanded(!expanded)}
          className={`text-xs text-slate-600 leading-relaxed bg-slate-50/50 p-2 rounded border border-slate-100 italic select-none cursor-pointer transition-colors hover:bg-slate-100/70 ${
            expanded ? '' : 'line-clamp-3'
          }`}
        >
          {sinopse}
        </p>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-[11px] font-medium text-[#136b77] hover:underline flex items-center gap-0.5 px-0.5"
        >
          {expanded ? (
            <>
              Ler menos <ChevronUp className="w-3 h-3" />
            </>
          ) : (
            <>
              Ler mais <ChevronDown className="w-3 h-3" />
            </>
          )}
        </button>
      </div>
    )
  }

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed bg-slate-50/50 p-2 rounded border border-slate-100 italic cursor-default">
            {sinopse}
          </p>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="center"
          className="max-w-xs sm:max-w-md bg-[#136b77] text-white border-none p-3 text-xs leading-relaxed shadow-xl rounded-lg font-normal break-words z-50"
        >
          {sinopse}
          <TooltipPrimitive.Arrow className="fill-[#136b77] w-3 h-1.5" />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export default function Acervo() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialQuery = searchParams.get('q') || ''

  const { isOperadorOrAdmin, isAdmin, user } = useAuth()
  const { toast } = useToast()
  const { refreshCounters } = useHeaderCounters()

  const [books, setBooks] = useState<TituloWithStats[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [totais, setTotais] = useState<TotaisAcervo | null>(null)
  const [loading, setLoading] = useState(true)

  const [searchQuery, setSearchQuery] = useState(initialQuery)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  // Modals state
  const [bookModalOpen, setBookModalOpen] = useState(false)
  const [bookToEdit, setBookToEdit] = useState<Titulo | null>(null)
  const [barcodeModalOpen, setBarcodeModalOpen] = useState(false)
  const [csvImportModalOpen, setCsvImportModalOpen] = useState(false)

  // Lightbox Zoom modal state (F-05)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxBook, setLightboxBook] = useState<{
    title: string
    author?: string
    coverUrl?: string | null
  } | null>(null)

  const [copiesModalOpen, setCopiesModalOpen] = useState(false)
  const [selectedBookForCopies, setSelectedBookForCopies] = useState<TituloWithStats | null>(null)

  const [loanModalOpen, setLoanModalOpen] = useState(false)
  const [preSelectedExemplar, setPreSelectedExemplar] = useState<string>('')

  const [reserveModalOpen, setReserveModalOpen] = useState(false)
  const [preSelectedTitulo, setPreSelectedTitulo] = useState<string>('')

  // Delete confirm modal state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [bookToDelete, setBookToDelete] = useState<{ id_titulo: string; title: string } | null>(
    null,
  )
  const [deleteLoading, setDeleteLoading] = useState(false)

  const loadBooks = async () => {
    setLoading(true)
    try {
      const [booksData, catsData, totaisData] = await Promise.all([
        TitulosService.getAll(searchQuery, selectedCategory, true),
        TitulosService.getCategories(),
        TitulosService.getTotais(),
      ])
      setBooks(booksData)
      setCategories(catsData)
      setTotais(totaisData)
      refreshCounters()
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar acervo',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBooks()
  }, [selectedCategory])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSearchParams(searchQuery ? { q: searchQuery } : {})
    loadBooks()
  }

  const handleEditBook = (book: TituloWithStats) => {
    setBookToEdit(book)
    setBookModalOpen(true)
  }

  const handleNewBook = () => {
    setBookToEdit(null)
    setBookModalOpen(true)
  }

  const handleBookScannedDirectly = (book: BookMetadata) => {
    setBookToEdit({
      id_titulo: '',
      titulo_de_livro: book.titulo_de_livro,
      autor: book.autor,
      autor_espiritual: book.autor_espiritual || null,
      autor_mediunico: book.autor_mediunico || null,
      author_id: null,
      editora: book.editora || null,
      ano_publicacao: book.ano_publicacao || null,
      isbn: book.isbn || null,
      categoria: book.categoria || 'Geral',
      sinopse: book.sinopse || null,
      vol: 0,
      capa_url: book.capa_url || null,
      ativo: true,
      created_at: new Date().toISOString(),
    })
    setBookModalOpen(true)
  }

  const handleOpenCopies = (book: TituloWithStats) => {
    setSelectedBookForCopies(book)
    setCopiesModalOpen(true)
  }

  const handleOpenLightbox = (book: TituloWithStats) => {
    setLightboxBook({
      title: book.titulo_de_livro,
      author: book.autor_formatado || book.autor,
      coverUrl: book.capa_url,
    })
    setLightboxOpen(true)
  }

  const handleDeleteBook = (id_titulo: string, title: string) => {
    setBookToDelete({ id_titulo, title })
    setDeleteConfirmOpen(true)
  }

  const handleConfirmDeleteBook = async () => {
    if (!bookToDelete) return
    setDeleteLoading(true)
    try {
      await TitulosService.delete(bookToDelete.id_titulo)
      toast({
        title: 'Livro excluído',
        description: `O título ${bookToDelete.id_titulo} foi removido com sucesso.`,
      })
      setDeleteConfirmOpen(false)
      setBookToDelete(null)
      loadBooks()
    } catch (err: any) {
      toast({
        title: 'Não foi possível excluir',
        description: err.message || 'Verifique se não há empréstimos vinculados.',
        variant: 'destructive',
      })
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleDirectReserve = (id_titulo: string) => {
    setPreSelectedTitulo(id_titulo)
    setReserveModalOpen(true)
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-emerald-600" />
            Catálogo & Acervo de Livros
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Consulte a disponibilidade de exemplares, gerencie cópias físicas e realize empréstimos.
          </p>
        </div>

        {isOperadorOrAdmin && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => setCsvImportModalOpen(true)}
              variant="outline"
              className="border-primary/40 text-primary hover:bg-primary/10 font-medium gap-2 shadow-xs"
            >
              <UploadCloud className="w-4 h-4" />
              Importar CSV
            </Button>
            <Button
              onClick={() => setBarcodeModalOpen(true)}
              variant="outline"
              className="border-emerald-600 text-emerald-700 hover:bg-emerald-50 font-medium gap-2 shadow-xs"
            >
              <Search className="w-4 h-4" />
              Ler Código de Barras
            </Button>
            <Button
              onClick={handleNewBook}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium gap-2 shadow-sm"
            >
              <PlusCircle className="w-4 h-4" />
              Cadastrar Novo Livro
            </Button>
          </div>
        )}
      </div>

      {/* Painel de Totais (F-10) */}
      {totais && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Card className="border-slate-200 shadow-2xs bg-white">
            <CardContent className="p-3.5 flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                <Library className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                  Títulos Únicos
                </p>
                <p className="text-xl font-bold text-slate-900">{totais.totalTitulos}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-2xs bg-white">
            <CardContent className="p-3.5 flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                <Layers2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                  Total de Exemplares
                </p>
                <p className="text-xl font-bold text-slate-900">{totais.totalExemplares}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-2xs bg-white">
            <CardContent className="p-3.5 flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                  Disponíveis
                </p>
                <p className="text-xl font-bold text-emerald-600">{totais.totalDisponiveis}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-2xs bg-white">
            <CardContent className="p-3.5 flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
                <Repeat className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                  Emprestados
                </p>
                <p className="text-xl font-bold text-amber-600">{totais.totalEmprestados}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-2xs bg-white col-span-2 sm:col-span-1">
            <CardContent className="p-3.5 flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
                <Wrench className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                  Em Manutenção
                </p>
                <p className="text-xl font-bold text-rose-600">{totais.totalManutencao}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter and Search Bar */}
      <Card className="border-slate-200 shadow-sm bg-white">
        <CardContent className="p-4">
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Buscar por título, autor, espírito, médium, ISBN ou código (Ex: MC-001)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs sm:text-sm"
              />
            </div>

            <div className="w-full sm:w-56">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="text-xs">
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <Filter className="w-3.5 h-3.5 text-emerald-600" />
                    <SelectValue placeholder="Todas as categorias" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Categorias</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="submit"
              variant="default"
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-5"
            >
              Pesquisar
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Results view */}
      {loading ? (
        <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <p className="text-xs text-slate-500 font-medium">
            Buscando títulos no banco de dados...
          </p>
        </div>
      ) : books.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-200 p-12 text-center bg-slate-50/50">
          <div className="max-w-md mx-auto space-y-3">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-semibold text-slate-800">Nenhum livro encontrado</h3>
            <p className="text-xs text-slate-500">
              Não encontramos nenhum título correspondente à sua pesquisa. Tente usar outros termos
              ou limpe o filtro.
            </p>
            {isOperadorOrAdmin && (
              <Button
                onClick={handleNewBook}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs mt-2"
              >
                Cadastrar este Livro Agora
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {books.map((book) => {
            const hasAvailable = book.exemplares_disponiveis > 0
            const hasCover = !!book.capa_url

            return (
              <Card
                key={book.id_titulo}
                className="overflow-hidden border-slate-200 hover:border-slate-300 hover:shadow-md transition-all flex flex-col justify-between group bg-white"
              >
                <div className="p-5 space-y-3">
                  {/* Top Bar: Code & Category */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 bg-slate-100 text-slate-800 rounded border border-slate-200">
                      {book.id_titulo}
                    </span>
                    <Badge
                      variant="secondary"
                      className="text-[11px] font-normal bg-slate-100 text-slate-600"
                    >
                      {book.categoria || 'Geral'}
                    </Badge>
                  </div>

                  {/* Book Body: Cover with Zoom + Title & Author (F-04 e F-05) */}
                  <div className="flex items-start gap-3">
                    <div
                      onClick={() => handleOpenLightbox(book)}
                      className={`w-14 h-20 rounded border overflow-hidden shrink-0 shadow-2xs relative group/cover cursor-pointer transition-transform hover:scale-105 ${
                        hasCover
                          ? 'bg-slate-100 border-slate-200'
                          : 'bg-slate-100 border-slate-200 flex items-center justify-center text-slate-400'
                      }`}
                      title="Clique para ampliar a foto da capa"
                    >
                      {hasCover ? (
                        <img
                          src={book.capa_url!}
                          alt={book.titulo_de_livro}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <BookOpen className="w-6 h-6 stroke-[1.2]" />
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/cover:opacity-100 flex items-center justify-center text-white transition-opacity">
                        <ZoomIn className="w-4 h-4" />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <h2 className="font-bold text-slate-900 text-base leading-snug group-hover:text-emerald-700 transition-colors line-clamp-2">
                        {book.titulo_de_livro}
                      </h2>

                      {/* Exibição formatada do Autor / Espírito / Médium (F-04) */}
                      <p className="text-xs font-semibold text-slate-700 mt-1 flex items-center gap-1 flex-wrap">
                        {book.autor_espiritual && (
                          <Sparkles className="w-3 h-3 text-amber-500 shrink-0 inline" />
                        )}
                        <span>{book.autor_formatado || book.autor}</span>
                      </p>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400 mt-2">
                        {book.editora && <span>Ed: {book.editora}</span>}
                        {book.ano_publicacao && <span>Ano: {book.ano_publicacao}</span>}
                        {book.isbn && <span className="font-mono">ISBN: {book.isbn}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Sinopse */}
                  {book.sinopse && book.sinopse.trim() !== '' && (
                    <BookSinopse sinopse={book.sinopse} />
                  )}

                  {/* Stock Status Pill (F-03) */}
                  <div className="pt-2">
                    <div
                      className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                        hasAvailable
                          ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                          : book.exemplares_manutencao > 0 &&
                              book.total_exemplares === book.exemplares_manutencao
                            ? 'bg-rose-50/70 border-rose-200 text-rose-900'
                            : 'bg-amber-50/70 border-amber-200 text-amber-900'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-medium">
                        {hasAvailable ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>{book.exemplares_disponiveis} exemplar(es) disponível(is)</span>
                          </>
                        ) : book.exemplares_manutencao > 0 &&
                          book.total_exemplares === book.exemplares_manutencao ? (
                          <>
                            <Wrench className="w-4 h-4 text-rose-600" />
                            <span>Exemplar(es) em manutenção</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-4 h-4 text-amber-600" />
                            <span>Todos os exemplares emprestados</span>
                          </>
                        )}
                      </div>
                      <span className="text-[11px] font-semibold opacity-75">
                        Total: {book.total_exemplares}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Actions Bar (F-08: Ícone de Reserva ao lado de Emprestar) */}
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs font-medium text-slate-700 hover:bg-slate-200/70 gap-1.5"
                      onClick={() => handleOpenCopies(book)}
                    >
                      <Layers className="w-3.5 h-3.5 text-emerald-600" />
                      Exemplares ({book.total_exemplares})
                    </Button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {hasAvailable ? (
                      isOperadorOrAdmin ? (
                        <Button
                          size="sm"
                          className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-1"
                          onClick={() => handleOpenCopies(book)}
                        >
                          <Repeat className="w-3.5 h-3.5" />
                          Emprestar
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs border-emerald-300 bg-emerald-50/50 text-emerald-800 hover:bg-emerald-50/50 hover:text-emerald-800 gap-1 cursor-default"
                          onClick={() => {
                            toast({
                              title: 'Disponível na Biblioteca',
                              description: `Solicite a retirada física da obra "${book.titulo_de_livro}" (${book.id_titulo}) no balcão de atendimento.`,
                            })
                          }}
                        >
                          Disponível
                        </Button>
                      )
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100 font-medium gap-1.5 shadow-2xs"
                        onClick={() => handleDirectReserve(book.id_titulo)}
                        title="Reservar obra quando todos os exemplares estiverem ocupados"
                      >
                        <BookmarkCheck className="w-3.5 h-3.5 text-amber-700" />
                        Reservar
                      </Button>
                    )}

                    {isOperadorOrAdmin && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-slate-500 hover:text-slate-900"
                        onClick={() => handleEditBook(book)}
                        title="Editar livro"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                    )}

                    {isAdmin && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                        onClick={() => handleDeleteBook(book.id_titulo, book.titulo_de_livro)}
                        title="Excluir livro do acervo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Modals */}
      <BookFormModal
        isOpen={bookModalOpen}
        onClose={() => setBookModalOpen(false)}
        bookToEdit={bookToEdit}
        onSuccess={loadBooks}
        categories={categories}
      />

      <BarcodeScannerModal
        open={barcodeModalOpen}
        onOpenChange={setBarcodeModalOpen}
        onBookFound={(meta) => {
          handleBookScannedDirectly(meta)
          setBarcodeModalOpen(false)
        }}
      />

      <CsvImportModal
        isOpen={csvImportModalOpen}
        onClose={() => setCsvImportModalOpen(false)}
        onSuccess={loadBooks}
        operatorName={user?.user_metadata?.name || user?.email || 'Administrador'}
      />

      <BookCoverLightboxModal
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        title={lightboxBook?.title || ''}
        author={lightboxBook?.author}
        coverUrl={lightboxBook?.coverUrl}
      />

      <CopiesModal
        isOpen={copiesModalOpen}
        onClose={() => setCopiesModalOpen(false)}
        book={selectedBookForCopies}
        onUpdate={loadBooks}
      />

      <LoanModal
        open={loanModalOpen}
        onOpenChange={setLoanModalOpen}
        preSelectedExemplarId={preSelectedExemplar}
        onSuccess={loadBooks}
      />

      <ReserveModal
        open={reserveModalOpen}
        onOpenChange={setReserveModalOpen}
        preSelectedTituloId={preSelectedTitulo}
        onSuccess={loadBooks}
      />

      <ConfirmModal
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Remover Livro do Acervo"
        description={`Deseja realmente remover a obra "${bookToDelete?.title}" (${bookToDelete?.id_titulo}) do acervo? Esta ação não pode ser desfeita.`}
        confirmLabel="Sim, Remover Livro"
        variant="destructive"
        loading={deleteLoading}
        onConfirm={handleConfirmDeleteBook}
      />
    </div>
  )
}
