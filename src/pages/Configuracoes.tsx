import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import {
  Settings,
  Clock,
  RotateCw,
  Save,
  Loader2,
  Zap,
  Info,
  RotateCcw,
  Building2,
  ShieldCheck,
  Sparkles,
  Tag,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  FileSpreadsheet,
  Download,
  Users2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ConfirmModal } from '@/components/ConfirmModal'
import { CategoriasService, Categoria } from '@/services/categorias'

const DEFAULT_PARAMS = {
  nome_biblioteca: {
    defaultValue: 'Biblioteca CEP',
    label: 'Nome da Biblioteca / Instituição',
    description: 'Identificação padrão exibida no cabeçalho, relatórios e comprovantes.',
    type: 'text' as const,
  },
  prazo_emprestimo_dias: {
    defaultValue: '15',
    label: 'Prazo Padrão de Empréstimo (Dias Corridos)',
    description: 'Quantidade de dias corridos para devolução ao criar novos empréstimos.',
    type: 'number' as const,
    min: 1,
    max: 180,
  },
  prazo_renovacao_dias: {
    defaultValue: '15',
    label: 'Prazo de Renovação (Dias Corridos)',
    description: 'Quantidade de dias corridos acrescentados a cada renovação de empréstimo.',
    type: 'number' as const,
    min: 1,
    max: 180,
  },
  max_renovacoes: {
    defaultValue: '1',
    label: 'Limite Máximo de Renovações',
    description: 'Quantidade máxima de vezes que um mesmo empréstimo pode ser renovado.',
    type: 'number' as const,
    min: 0,
    max: 10,
  },
  max_exemplares_por_leitor: {
    defaultValue: '3',
    label: 'Limite de Exemplares Simultâneos por Leitor',
    description: 'Número máximo de livros ativos emprestados simultaneamente por leitor.',
    type: 'number' as const,
    min: 1,
    max: 20,
  },
  prazo_reserva_dias: {
    defaultValue: '5',
    label: 'Prazo de Tolerância de Reserva (Dias Corridos)',
    description: 'Dias em que um exemplar reservado fica retido aguardando retirada pelo leitor.',
    type: 'number' as const,
    min: 1,
    max: 30,
  },
  label_estrutura_espirito_medium: {
    defaultValue: 'Espírito + Médium',
    label: 'Rótulo da Estrutura: Espírito + Médium',
    description:
      'Nome personalizado exibido no seletor de autoria para livros psicografados / mediúnicos.',
    type: 'text' as const,
  },
  label_estrutura_convencional: {
    defaultValue: 'Autor Convencional',
    label: 'Rótulo da Estrutura: Autor Convencional',
    description:
      'Nome personalizado exibido no seletor de autoria para autores encarnados / literatura geral.',
    type: 'text' as const,
  },
}

export default function Configuracoes() {
  const { isAdmin } = useAuth()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [runningRoutine, setRunningRoutine] = useState(false)

  // Categories CRUD state
  const [categories, setCategories] = useState<Categoria[]>([])
  const [loadingCategories, setLoadingCategories] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [addingCategory, setAddingCategory] = useState(false)
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null)
  const [editingCategoryName, setEditingCategoryName] = useState('')
  const [savingCategoryEdit, setSavingCategoryEdit] = useState(false)
  const [deleteCategoryModalOpen, setDeleteCategoryModalOpen] = useState(false)
  const [categoryToDelete, setCategoryToDelete] = useState<Categoria | null>(null)
  const [deletingCategory, setDeletingCategory] = useState(false)

  // State values for parameters
  const [prazoEmprestimoDias, setPrazoEmprestimoDias] = useState(
    DEFAULT_PARAMS.prazo_emprestimo_dias.defaultValue,
  )
  const [prazoRenovacaoDias, setPrazoRenovacaoDias] = useState(
    DEFAULT_PARAMS.prazo_renovacao_dias.defaultValue,
  )
  const [maxRenovacoes, setMaxRenovacoes] = useState(DEFAULT_PARAMS.max_renovacoes.defaultValue)
  const [maxExemplaresPorLeitor, setMaxExemplaresPorLeitor] = useState(
    DEFAULT_PARAMS.max_exemplares_por_leitor.defaultValue,
  )
  const [prazoReservaDias, setPrazoReservaDias] = useState(
    DEFAULT_PARAMS.prazo_reserva_dias.defaultValue,
  )
  const [nomeBiblioteca, setNomeBiblioteca] = useState(DEFAULT_PARAMS.nome_biblioteca.defaultValue)
  const [labelEspiritoMedium, setLabelEspiritoMedium] = useState(
    DEFAULT_PARAMS.label_estrutura_espirito_medium.defaultValue,
  )
  const [labelConvencional, setLabelConvencional] = useState(
    DEFAULT_PARAMS.label_estrutura_convencional.defaultValue,
  )

  const loadParams = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('parametros').select('*')

      if (error) throw error

      if (data && data.length > 0) {
        const paramMap = new Map<string, string>()
        data.forEach((p) => {
          paramMap.set(p.chave, p.valor)
        })

        if (paramMap.has('prazo_emprestimo_dias')) {
          setPrazoEmprestimoDias(paramMap.get('prazo_emprestimo_dias')!)
        } else if (paramMap.has('prazo_devolucao_dias')) {
          setPrazoEmprestimoDias(paramMap.get('prazo_devolucao_dias')!)
        }

        if (paramMap.has('prazo_renovacao_dias')) {
          setPrazoRenovacaoDias(paramMap.get('prazo_renovacao_dias')!)
        }

        if (paramMap.has('max_renovacoes')) {
          setMaxRenovacoes(paramMap.get('max_renovacoes')!)
        }

        if (paramMap.has('max_exemplares_por_leitor')) {
          setMaxExemplaresPorLeitor(paramMap.get('max_exemplares_por_leitor')!)
        }

        if (paramMap.has('prazo_reserva_dias')) {
          setPrazoReservaDias(paramMap.get('prazo_reserva_dias')!)
        }

        if (paramMap.has('nome_biblioteca')) {
          setNomeBiblioteca(paramMap.get('nome_biblioteca')!)
        }

        if (paramMap.has('label_estrutura_espirito_medium')) {
          setLabelEspiritoMedium(paramMap.get('label_estrutura_espirito_medium')!)
        }

        if (paramMap.has('label_estrutura_convencional')) {
          setLabelConvencional(paramMap.get('label_estrutura_convencional')!)
        }
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar parâmetros',
        description: err.message || 'Não foi possível buscar as configurações.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const loadCategories = async () => {
    setLoadingCategories(true)
    try {
      const data = await CategoriasService.getAll()
      setCategories(data)
    } catch (err: any) {
      console.error('Erro ao buscar categorias:', err)
    } finally {
      setLoadingCategories(false)
    }
  }

  useEffect(() => {
    loadParams()
    loadCategories()
  }, [])

  const handleDownloadTemplateCsv = () => {
    const csvContent =
      'isbn;titulo;autor_espiritual;autor_mediunico;autor;editora;ano_publicacao;categoria;sinopse;exemplares;localizacao\n' +
      '9788573286885;Nosso Lar;André Luiz;Chico Xavier;;FEB;2010;Doutrinário Espírita;A vida no mundo espiritual narrada pelo espírito André Luiz.;2;Estante 1\n' +
      '9788573286878;O Livro dos Espíritos;;;Allan Kardec;FEB;2015;Obras Básicas;Filosofia e ciência espírita.;3;Estante Central\n' +
      '9788579450006;Missionários da Luz;André Luiz;Chico Xavier;;FEB;2011;Doutrinário Espírita;Estudo sobre os processos de reencarnação.;1;Estante 2\n'

    // Adiciona BOM UTF-8 (\uFEFF) para Excel abrir perfeitamente com acentuação em PT-BR
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'template_cadastro_livros_cep.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast({
      title: 'Download iniciado',
      description: 'Template CSV exportado com sucesso (compatível com Excel e LibreOffice).',
    })
  }

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCategoryName.trim()) return

    setAddingCategory(true)
    try {
      await CategoriasService.create(newCategoryName)
      toast({
        title: 'Categoria criada',
        description: `A categoria "${newCategoryName.trim()}" foi adicionada com sucesso.`,
      })
      setNewCategoryName('')
      await loadCategories()
    } catch (err: any) {
      toast({
        title: 'Erro ao criar categoria',
        description: err.message || 'Não foi possível cadastrar a categoria.',
        variant: 'destructive',
      })
    } finally {
      setAddingCategory(false)
    }
  }

  const handleStartEditCategory = (cat: Categoria) => {
    setEditingCategoryId(cat.id)
    setEditingCategoryName(cat.nome)
  }

  const handleCancelEditCategory = () => {
    setEditingCategoryId(null)
    setEditingCategoryName('')
  }

  const handleSaveEditCategory = async (cat: Categoria) => {
    if (!editingCategoryName.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'O nome da categoria não pode ficar vazio.',
        variant: 'destructive',
      })
      return
    }

    setSavingCategoryEdit(true)
    try {
      await CategoriasService.update(cat.id, cat.nome, editingCategoryName)
      toast({
        title: 'Categoria atualizada',
        description: `A categoria "${cat.nome}" foi alterada para "${editingCategoryName.trim()}". Os títulos vinculados foram atualizados.`,
      })
      setEditingCategoryId(null)
      setEditingCategoryName('')
      await loadCategories()
    } catch (err: any) {
      toast({
        title: 'Erro ao atualizar categoria',
        description: err.message || 'Não foi possível atualizar a categoria.',
        variant: 'destructive',
      })
    } finally {
      setSavingCategoryEdit(false)
    }
  }

  const handleOpenDeleteCategory = (cat: Categoria) => {
    setCategoryToDelete(cat)
    setDeleteCategoryModalOpen(true)
  }

  const handleExecuteDeleteCategory = async () => {
    if (!categoryToDelete) return
    setDeletingCategory(true)
    try {
      await CategoriasService.delete(categoryToDelete.id, categoryToDelete.nome)
      toast({
        title: 'Categoria excluída',
        description: `A categoria "${categoryToDelete.nome}" foi removida. Os títulos associados tiveram a categoria desvinculada (em branco).`,
      })
      setDeleteCategoryModalOpen(false)
      setCategoryToDelete(null)
      await loadCategories()
    } catch (err: any) {
      toast({
        title: 'Erro ao excluir categoria',
        description: err.message || 'Não foi possível remover a categoria.',
        variant: 'destructive',
      })
    } finally {
      setDeletingCategory(false)
    }
  }

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setSaving(true)

    const payload = [
      {
        chave: 'prazo_emprestimo_dias',
        valor: String(prazoEmprestimoDias || DEFAULT_PARAMS.prazo_emprestimo_dias.defaultValue),
        descricao: DEFAULT_PARAMS.prazo_emprestimo_dias.description,
      },
      {
        chave: 'prazo_renovacao_dias',
        valor: String(prazoRenovacaoDias || DEFAULT_PARAMS.prazo_renovacao_dias.defaultValue),
        descricao: DEFAULT_PARAMS.prazo_renovacao_dias.description,
      },
      {
        chave: 'max_renovacoes',
        valor: String(maxRenovacoes || DEFAULT_PARAMS.max_renovacoes.defaultValue),
        descricao: DEFAULT_PARAMS.max_renovacoes.description,
      },
      {
        chave: 'max_exemplares_por_leitor',
        valor: String(
          maxExemplaresPorLeitor || DEFAULT_PARAMS.max_exemplares_por_leitor.defaultValue,
        ),
        descricao: DEFAULT_PARAMS.max_exemplares_por_leitor.description,
      },
      {
        chave: 'prazo_reserva_dias',
        valor: String(prazoReservaDias || DEFAULT_PARAMS.prazo_reserva_dias.defaultValue),
        descricao: DEFAULT_PARAMS.prazo_reserva_dias.description,
      },
      {
        chave: 'nome_biblioteca',
        valor: String(nomeBiblioteca || DEFAULT_PARAMS.nome_biblioteca.defaultValue).trim(),
        descricao: DEFAULT_PARAMS.nome_biblioteca.description,
      },
      {
        chave: 'label_estrutura_espirito_medium',
        valor: String(
          labelEspiritoMedium || DEFAULT_PARAMS.label_estrutura_espirito_medium.defaultValue,
        ).trim(),
        descricao: DEFAULT_PARAMS.label_estrutura_espirito_medium.description,
      },
      {
        chave: 'label_estrutura_convencional',
        valor: String(
          labelConvencional || DEFAULT_PARAMS.label_estrutura_convencional.defaultValue,
        ).trim(),
        descricao: DEFAULT_PARAMS.label_estrutura_convencional.description,
      },
    ]

    try {
      const { error } = await supabase.from('parametros').upsert(payload, {
        onConflict: 'chave',
      })

      if (error) throw error

      toast({
        title: 'Configurações salvas com sucesso!',
        description: 'Todos os parâmetros operacionais e rótulos de autoria foram gravados.',
      })

      await loadParams()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar configurações',
        description: err.message || 'Não foi possível atualizar os parâmetros no banco.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleRestoreDefaults = () => {
    setPrazoEmprestimoDias(DEFAULT_PARAMS.prazo_emprestimo_dias.defaultValue)
    setPrazoRenovacaoDias(DEFAULT_PARAMS.prazo_renovacao_dias.defaultValue)
    setMaxRenovacoes(DEFAULT_PARAMS.max_renovacoes.defaultValue)
    setMaxExemplaresPorLeitor(DEFAULT_PARAMS.max_exemplares_por_leitor.defaultValue)
    setPrazoReservaDias(DEFAULT_PARAMS.prazo_reserva_dias.defaultValue)
    setNomeBiblioteca(DEFAULT_PARAMS.nome_biblioteca.defaultValue)
    setLabelEspiritoMedium(DEFAULT_PARAMS.label_estrutura_espirito_medium.defaultValue)
    setLabelConvencional(DEFAULT_PARAMS.label_estrutura_convencional.defaultValue)

    toast({
      title: 'Valores padrão restaurados no formulário',
      description: 'Clique em "Salvar Configurações" para gravar as alterações no sistema.',
      variant: 'info',
    })
  }

  const handleRunOverdueCheck = async () => {
    setRunningRoutine(true)
    try {
      const { data, error } = await supabase.rpc('verificar_atrasos_geral')
      if (error) throw error

      toast({
        title: 'Rotina executada',
        description: `Verificação de atrasos concluída (${data ?? 0} registros avaliados/atualizados).`,
        className: 'bg-white text-slate-900 border-slate-200 shadow-lg',
      })
    } catch (err: any) {
      toast({
        title: 'Erro na rotina',
        description: err.message || 'Falha ao executar verificar_atrasos_geral.',
        variant: 'destructive',
      })
    } finally {
      setRunningRoutine(false)
    }
  }

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Settings className="w-6 h-6 text-emerald-600" />
            Configurações do Sistema
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Gerencie os parâmetros operacionais, prazos, estruturas de autoria, modelo CSV e rotinas
            da biblioteca.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs py-1 px-2.5 gap-1"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            {isAdmin ? 'Modo Administrador' : 'Modo Visualização'}
          </Badge>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <p className="text-xs text-slate-500 font-medium">Carregando configurações...</p>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {/* Card 1: Identificação Institucional */}
          <Card className="border-slate-200 bg-white shadow-xs">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-600" />
                Identificação da Unidade
              </CardTitle>
              <CardDescription className="text-xs">
                Informações visíveis aos usuários e nas emissões do sistema.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="nome_biblioteca" className="text-xs font-semibold text-slate-700">
                    {DEFAULT_PARAMS.nome_biblioteca.label}
                  </Label>
                  <span className="text-[11px] text-slate-400 font-mono">
                    chave: nome_biblioteca
                  </span>
                </div>
                <Input
                  id="nome_biblioteca"
                  type="text"
                  value={nomeBiblioteca}
                  onChange={(e) => setNomeBiblioteca(e.target.value)}
                  disabled={!isAdmin || saving}
                  placeholder="Biblioteca CEP"
                  className="text-sm font-medium"
                />
                <p className="text-[11px] text-slate-500">
                  {DEFAULT_PARAMS.nome_biblioteca.description}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Card: Rótulos e Estrutura de Autoria */}
          <Card className="border-slate-200 bg-white shadow-xs">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users2 className="w-5 h-5 text-emerald-600" />
                Estruturas & Rótulos de Autoria
              </CardTitle>
              <CardDescription className="text-xs">
                Personalize os títulos e rótulos exibidos nos formulários de cadastro de livros e
                seletores de autoria.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="label_espirito_medium"
                      className="text-xs font-semibold text-slate-700"
                    >
                      {DEFAULT_PARAMS.label_estrutura_espirito_medium.label}
                    </Label>
                    <span className="text-[11px] text-slate-400 font-mono">
                      chave: label_estrutura_espirito_medium
                    </span>
                  </div>
                  <Input
                    id="label_espirito_medium"
                    type="text"
                    value={labelEspiritoMedium}
                    onChange={(e) => setLabelEspiritoMedium(e.target.value)}
                    disabled={!isAdmin || saving}
                    placeholder="Espírito + Médium"
                    className="text-sm font-medium"
                  />
                  <p className="text-[11px] text-slate-500">
                    {DEFAULT_PARAMS.label_estrutura_espirito_medium.description}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="label_convencional"
                      className="text-xs font-semibold text-slate-700"
                    >
                      {DEFAULT_PARAMS.label_estrutura_convencional.label}
                    </Label>
                    <span className="text-[11px] text-slate-400 font-mono">
                      chave: label_estrutura_convencional
                    </span>
                  </div>
                  <Input
                    id="label_convencional"
                    type="text"
                    value={labelConvencional}
                    onChange={(e) => setLabelConvencional(e.target.value)}
                    disabled={!isAdmin || saving}
                    placeholder="Autor Convencional"
                    className="text-sm font-medium"
                  />
                  <p className="text-[11px] text-slate-500">
                    {DEFAULT_PARAMS.label_estrutura_convencional.description}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card: Template CSV para Importação em Lote */}
          <Card className="border-slate-200 bg-white shadow-xs">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                Template CSV para Cadastro de Livros
              </CardTitle>
              <CardDescription className="text-xs">
                Baixe o modelo oficial em formato CSV com cabeçalhos pré-formatados e exemplos
                prontos para preenchimento.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-900">
                    Arquivo Modelo de Importação (template_cadastro_livros_cep.csv)
                  </p>
                  <p className="text-[11px] text-slate-500 leading-relaxed max-w-xl">
                    Contém as colunas:{' '}
                    <code className="bg-slate-200/80 px-1 py-0.5 rounded text-[10px] font-mono">
                      isbn;titulo;autor_espiritual;autor_mediunico;autor;editora;ano_publicacao;categoria;sinopse;exemplares;localizacao
                    </code>{' '}
                    com codificação UTF-8 pronta para Excel.
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={handleDownloadTemplateCsv}
                  variant="outline"
                  size="sm"
                  className="bg-white hover:bg-emerald-50 border-emerald-600/40 text-emerald-700 hover:text-emerald-800 text-xs font-medium gap-2 shrink-0 shadow-2xs"
                >
                  <Download className="w-4 h-4" />
                  Baixar Template CSV
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Políticas de Empréstimos & Renovações */}
          <Card className="border-slate-200 bg-white shadow-xs">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-600" />
                Políticas de Circulação & Prazos
              </CardTitle>
              <CardDescription className="text-xs">
                Defina os prazos padrão para cálculo automático da data prevista e tolerâncias de
                devolução.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Prazo de Empréstimo */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="prazo_emprestimo_dias"
                      className="text-xs font-semibold text-slate-700"
                    >
                      {DEFAULT_PARAMS.prazo_emprestimo_dias.label}
                    </Label>
                  </div>
                  <Input
                    id="prazo_emprestimo_dias"
                    type="number"
                    min={DEFAULT_PARAMS.prazo_emprestimo_dias.min}
                    max={DEFAULT_PARAMS.prazo_emprestimo_dias.max}
                    value={prazoEmprestimoDias}
                    onChange={(e) => setPrazoEmprestimoDias(e.target.value)}
                    disabled={!isAdmin || saving}
                    className="text-sm font-medium font-mono"
                  />
                  <p className="text-[11px] text-slate-500">
                    Padrão: <span className="font-semibold text-slate-700">15 dias</span> corridos.
                  </p>
                </div>

                {/* Prazo de Renovação */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="prazo_renovacao_dias"
                      className="text-xs font-semibold text-slate-700"
                    >
                      {DEFAULT_PARAMS.prazo_renovacao_dias.label}
                    </Label>
                  </div>
                  <Input
                    id="prazo_renovacao_dias"
                    type="number"
                    min={DEFAULT_PARAMS.prazo_renovacao_dias.min}
                    max={DEFAULT_PARAMS.prazo_renovacao_dias.max}
                    value={prazoRenovacaoDias}
                    onChange={(e) => setPrazoRenovacaoDias(e.target.value)}
                    disabled={!isAdmin || saving}
                    className="text-sm font-medium font-mono"
                  />
                  <p className="text-[11px] text-slate-500">
                    {DEFAULT_PARAMS.prazo_renovacao_dias.description}
                  </p>
                </div>

                {/* Limite Máximo de Renovações */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="max_renovacoes"
                      className="text-xs font-semibold text-slate-700"
                    >
                      {DEFAULT_PARAMS.max_renovacoes.label}
                    </Label>
                  </div>
                  <Input
                    id="max_renovacoes"
                    type="number"
                    min={DEFAULT_PARAMS.max_renovacoes.min}
                    max={DEFAULT_PARAMS.max_renovacoes.max}
                    value={maxRenovacoes}
                    onChange={(e) => setMaxRenovacoes(e.target.value)}
                    disabled={!isAdmin || saving}
                    className="text-sm font-medium font-mono"
                  />
                  <p className="text-[11px] text-slate-500">
                    Padrão: <span className="font-semibold text-slate-700">1 renovação</span> por
                    empréstimo.
                  </p>
                </div>

                {/* Limite de Exemplares por Leitor */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="max_exemplares_por_leitor"
                      className="text-xs font-semibold text-slate-700"
                    >
                      {DEFAULT_PARAMS.max_exemplares_por_leitor.label}
                    </Label>
                  </div>
                  <Input
                    id="max_exemplares_por_leitor"
                    type="number"
                    min={DEFAULT_PARAMS.max_exemplares_por_leitor.min}
                    max={DEFAULT_PARAMS.max_exemplares_por_leitor.max}
                    value={maxExemplaresPorLeitor}
                    onChange={(e) => setMaxExemplaresPorLeitor(e.target.value)}
                    disabled={!isAdmin || saving}
                    className="text-sm font-medium font-mono"
                  />
                  <p className="text-[11px] text-slate-500">
                    Padrão: <span className="font-semibold text-slate-700">3 exemplares</span>{' '}
                    simultâneos.
                  </p>
                </div>

                {/* Prazo de Reserva */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="prazo_reserva_dias"
                      className="text-xs font-semibold text-slate-700"
                    >
                      {DEFAULT_PARAMS.prazo_reserva_dias.label}
                    </Label>
                  </div>
                  <Input
                    id="prazo_reserva_dias"
                    type="number"
                    min={DEFAULT_PARAMS.prazo_reserva_dias.min}
                    max={DEFAULT_PARAMS.prazo_reserva_dias.max}
                    value={prazoReservaDias}
                    onChange={(e) => setPrazoReservaDias(e.target.value)}
                    disabled={!isAdmin || saving}
                    className="text-sm font-medium font-mono"
                  />
                  <p className="text-[11px] text-slate-500">
                    Padrão: <span className="font-semibold text-slate-700">5 dias</span> de
                    tolerância.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Bar (Salvar / Restaurar) */}
          {isAdmin && (
            <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRestoreDefaults}
                disabled={saving}
                className="w-full sm:w-auto text-xs font-medium gap-1.5 text-slate-600 hover:text-slate-900"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restaurar Padrões
              </Button>

              <Button
                type="submit"
                disabled={saving}
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold gap-1.5 shadow-sm px-5"
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                Salvar Configurações
              </Button>
            </div>
          )}

          {/* Seção CRUD de Categorias */}
          <Card className="border-slate-200 bg-white shadow-xs">
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Tag className="w-5 h-5 text-emerald-600" />
                    Categorias & Gêneros Literários
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Gerencie a lista oficial de categorias do acervo. A edição atualiza todos os
                    livros vinculados em cascata, e a exclusão desvincula a categoria dos livros sem
                    excluí-los.
                  </CardDescription>
                </div>
                <Badge
                  variant="outline"
                  className="w-fit text-xs font-medium text-slate-600 bg-slate-50 border-slate-200"
                >
                  {categories.length} {categories.length === 1 ? 'categoria' : 'categorias'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Formulário de Adicionar Categoria */}
              {isAdmin && (
                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-xs font-semibold text-slate-800 mb-2 flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-emerald-600" />
                    Nova Categoria
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      type="text"
                      placeholder="Ex: Romance Espírita, Filosofia, Estudo..."
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      disabled={addingCategory}
                      className="text-xs bg-white flex-1"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddCategory(e)
                        }
                      }}
                    />
                    <Button
                      type="button"
                      onClick={handleAddCategory}
                      disabled={addingCategory || !newCategoryName.trim()}
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium gap-1 shrink-0"
                    >
                      {addingCategory ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Plus className="w-3.5 h-3.5" />
                      )}
                      Adicionar Categoria
                    </Button>
                  </div>
                </div>
              )}

              {/* Lista de Categorias */}
              {loadingCategories ? (
                <div className="py-8 text-center flex items-center justify-center gap-2 text-xs text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                  Carregando categorias...
                </div>
              ) : categories.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 border border-dashed rounded-lg">
                  Nenhuma categoria cadastrada no momento.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden bg-white">
                  {categories.map((cat) => {
                    const isEditing = editingCategoryId === cat.id
                    return (
                      <div
                        key={cat.id}
                        className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/70 transition-colors"
                      >
                        {isEditing ? (
                          <div className="flex items-center gap-2 flex-1">
                            <Input
                              type="text"
                              value={editingCategoryName}
                              onChange={(e) => setEditingCategoryName(e.target.value)}
                              disabled={savingCategoryEdit}
                              className="text-xs h-8 bg-white"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  handleSaveEditCategory(cat)
                                } else if (e.key === 'Escape') {
                                  handleCancelEditCategory()
                                }
                              }}
                            />
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleSaveEditCategory(cat)}
                              disabled={savingCategoryEdit || !editingCategoryName.trim()}
                              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-2.5"
                              title="Salvar alterações"
                            >
                              {savingCategoryEdit ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={handleCancelEditCategory}
                              disabled={savingCategoryEdit}
                              className="h-8 text-xs text-slate-500 hover:text-slate-800 px-2"
                              title="Cancelar edição"
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="font-semibold text-xs text-slate-800 truncate">
                              {cat.nome}
                            </span>
                          </div>
                        )}

                        {!isEditing && isAdmin && (
                          <div className="flex items-center gap-1 self-end sm:self-center shrink-0">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => handleStartEditCategory(cat)}
                              className="h-7 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 gap-1 px-2"
                              title="Editar nome da categoria"
                            >
                              <Edit2 className="w-3 h-3 text-slate-500" />
                              Editar
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenDeleteCategory(cat)}
                              className="h-7 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 gap-1 px-2"
                              title="Excluir categoria"
                            >
                              <Trash2 className="w-3 h-3" />
                              Excluir
                            </Button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Maintenance & Integrity Routine */}
          <Card className="border-slate-200 bg-white shadow-xs">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                Rotinas de Integridade & Verificação de Atrasos
              </CardTitle>
              <CardDescription className="text-xs">
                Dispare rotinas no banco de dados para recalcular atrasos e sincronizar o status dos
                empréstimos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    Recalcular Atrasos Imediatamente
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Executa a função{' '}
                    <code className="bg-slate-200 px-1 rounded font-mono text-[10px]">
                      verificar_atrasos_geral()
                    </code>{' '}
                    no Supabase.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleRunOverdueCheck}
                  disabled={runningRoutine || !isAdmin}
                  className="bg-gray-500 hover:bg-gray-600 text-white text-xs font-medium shrink-0"
                >
                  {runningRoutine ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                  ) : (
                    <RotateCw className="w-3.5 h-3.5 mr-1" />
                  )}
                  Executar Verificação
                </Button>
              </div>

              <div className="bg-emerald-50/60 p-3.5 rounded-lg border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1 text-[11px] leading-relaxed">
                  <p className="font-semibold text-emerald-950">Operação Institucional Gratuita</p>
                  <p>
                    A Biblioteca CEP não aplica multas financeiras. As configurações aqui
                    cadastradas regulam a rotatividade justa e o controle de devoluções.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </form>
      )}

      {/* Modal de Confirmação de Exclusão de Categoria */}
      <ConfirmModal
        open={deleteCategoryModalOpen}
        onOpenChange={setDeleteCategoryModalOpen}
        title="Excluir Categoria"
        description={
          categoryToDelete ? (
            <span>
              Tem certeza que deseja excluir a categoria{' '}
              <strong className="text-rose-600 font-bold">"{categoryToDelete.nome}"</strong>? Os
              títulos vinculados a ela não serão apagados, mas ficarão com a categoria em
              branco/desvinculada.
            </span>
          ) : (
            'Tem certeza que deseja excluir esta categoria?'
          )
        }
        confirmLabel="Sim, Excluir Categoria"
        cancelLabel="Cancelar"
        variant="destructive"
        loading={deletingCategory}
        onConfirm={handleExecuteDeleteCategory}
      />
    </div>
  )
}
