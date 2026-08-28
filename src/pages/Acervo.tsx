import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { TitulosService, TituloWithStats, Titulo } from '@/services/titulos'
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
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { useIsMobile } from '@/hooks/use-mobile'
import { BookFormModal } from '@/components/BookFormModal'
import { CopiesModal } from '@/components/CopiesModal'
import { LoanModal } from '@/components/LoanModal'
import { ReserveModal } from '@/components/ReserveModal'
import { ConfirmModal } from '@/components/ConfirmModal'
import { useToast } from '@/hooks/use-toast'

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

  const { isOperadorOrAdmin, isAdmin } = useAuth()
  const { toast } = useToast()

  const [books, setBooks] = useState<TituloWithStats[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const [searchQuery, setSearchQuery] = useState(initialQuery)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  // Modals state
  const [bookModalOpen, setBookModalOpen] = useState(false)
  const [bookToEdit, setBookToEdit] = useState<Titulo | null>(null)

  const [copiesModalOpen, setCopiesModalOpen] = useState(false)
  const [selectedBookForCopies, setSelectedBookForCopies] = useState<Titulo | null>(null)

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
      const [booksData, catsData] = await Promise.all([
        TitulosService.getAll(searchQuery, selectedCategory, true),
        TitulosService.getCategories(),
      ])
      setBooks(booksData)
      setCategories(catsData)
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

  const handleEditBook = (book: Titulo) => {
    setBookToEdit(book)
    setBookModalOpen(true)
  }

  const handleNewBook = () => {
    setBookToEdit(null)
    setBookModalOpen(true)
  }

  const handleOpenCopies = (book: Titulo) => {
    setSelectedBookForCopies(book)
    setCopiesModalOpen(true)
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

  const handleDirectLoan = (exemplarId: string) => {
    setPreSelectedExemplar(exemplarId)
    setLoanModalOpen(true)
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
          <Button
            onClick={handleNewBook}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium gap-2 shadow-sm"
          >
            <PlusCircle className="w-4 h-4" />
            Cadastrar Novo Livro
          </Button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <Card className="border-slate-200 shadow-sm bg-white">
        <CardContent className="p-4">
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Buscar por título, autor, editora, ISBN ou código (Ex: MC-001)..."
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

                  {/* Book Body: Cover + Title & Author */}
                  <div className="flex items-start gap-3">
                    {book.capa_url && (
                      <div className="w-14 h-20 bg-slate-100 rounded border border-slate-200 overflow-hidden shrink-0 shadow-2xs">
                        <img
                          src={book.capa_url}
                          alt={book.titulo_de_livro}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h2 className="font-bold text-slate-900 text-base leading-snug group-hover:text-emerald-700 transition-colors line-clamp-2">
                        {book.titulo_de_livro}
                      </h2>
                      <p className="text-xs font-semibold text-slate-600 mt-1">{book.autor}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400 mt-2">
                        {book.editora && <span>Ed: {book.editora}</span>}
                        {book.ano_publicacao && <span>Ano: {book.ano_publicacao}</span>}
                        {book.isbn && <span>ISBN: {book.isbn}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Sinopse */}
                  {book.sinopse && book.sinopse.trim() !== '' && (
                    <BookSinopse sinopse={book.sinopse} />
                  )}

                  {/* Stock Status Pill */}
                  <div className="pt-2">
                    <div
                      className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                        hasAvailable
                          ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                          : 'bg-amber-50/70 border-amber-200 text-amber-900'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-medium">
                        {hasAvailable ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>{book.exemplares_disponiveis} exemplar(es) disponível(is)</span>
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

                {/* Bottom Actions Bar */}
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
                          onClick={() => {
                            // Find an available exemplar code or open copies
                            handleOpenCopies(book)
                          }}
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
                              description: `Solicite a retirada física do exemplar ${book.id_titulo} no balcão de atendimento.`,
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
                        className="h-8 text-xs border-amber-300 bg-amber-50/50 text-amber-800 hover:bg-amber-50/50 hover:text-amber-800 font-medium gap-1"
                        onClick={() => handleDirectReserve(book.id_titulo)}
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
        open={bookModalOpen}
        onOpenChange={setBookModalOpen}
        bookToEdit={bookToEdit}
        onSuccess={loadBooks}
      />

      <CopiesModal
        open={copiesModalOpen}
        onOpenChange={setCopiesModalOpen}
        titulo={selectedBookForCopies}
        onCopiesUpdated={loadBooks}
        onRequestLoan={handleDirectLoan}
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
