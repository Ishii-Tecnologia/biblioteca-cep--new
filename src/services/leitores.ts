import { supabase } from '@/lib/supabase/client'
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/supabase/types'

export type Leitor = Tables<'leitor'>
export type LeitorInsert = TablesInsert<'leitor'>
export type LeitorUpdate = TablesUpdate<'leitor'>

export interface LeitorWithStats extends Leitor {
  emprestimos_ativos: number
  emprestimos_atrasados: number
  total_emprestimos: number
}

export const LeitoresService = {
  async getAll(searchQuery?: string, filterStatus?: 'all' | 'ativos' | 'bloqueados') {
    let query = supabase
      .from('leitor')
      .select('*, emprestimo(id_emprestimo, data_devolucao_real, atraso, data_prevista_devolucao)')
      .order('nome_do_leitor', { ascending: true })

    if (filterStatus === 'ativos') {
      query = query.eq('bloqueado', false)
    } else if (filterStatus === 'bloqueados') {
      query = query.eq('bloqueado', true)
    }

    if (searchQuery && searchQuery.trim()) {
      const q = `%${searchQuery.trim()}%`
      query = query.or(
        `nome_do_leitor.ilike.${q},email.ilike.${q},cpf.ilike.${q},telefone.ilike.${q}`,
      )
    }

    const { data, error } = await query
    if (error) throw error

    const now = new Date()
    const formatted: LeitorWithStats[] = (data || []).map((l: any) => {
      const loans = l.emprestimo || []
      const activeLoans = loans.filter((lo: any) => !lo.data_devolucao_real)
      const overdueLoans = activeLoans.filter((lo: any) => {
        if (lo.atraso) return true
        if (lo.data_prevista_devolucao) {
          return new Date(lo.data_prevista_devolucao) < now
        }
        return false
      })

      return {
        id_leitor: l.id_leitor,
        id_auth: l.id_auth,
        cpf: l.cpf,
        nome_do_leitor: l.nome_do_leitor,
        email: l.email,
        telefone: l.telefone,
        data_cadastro: l.data_cadastro,
        bloqueado: l.bloqueado,
        foto: l.foto || null,
        created_at: l.created_at,
        emprestimos_ativos: activeLoans.length,
        emprestimos_atrasados: overdueLoans.length,
        total_emprestimos: loans.length,
      }
    })

    return formatted
  },

  async getById(id_leitor: number) {
    const { data, error } = await supabase
      .from('leitor')
      .select(`
        *,
        emprestimo(
          *,
          exemplar(*, titulo(*))
        ),
        reserva(
          *,
          titulo(*)
        )
      `)
      .eq('id_leitor', id_leitor)
      .single()

    if (error) throw error
    return data
  },

  async checkCpfExists(cpf: string, excludeIdLeitor?: number): Promise<boolean> {
    const cleanCpf = cpf.replace(/\D/g, '')
    if (!cleanCpf) return false

    // Formatos possíveis salvos no banco: formatado ou apenas dígitos
    const formattedCpf = `${cleanCpf.slice(0, 3)}.${cleanCpf.slice(3, 6)}.${cleanCpf.slice(6, 9)}-${cleanCpf.slice(9, 11)}`

    let query = supabase
      .from('leitor')
      .select('id_leitor')
      .or(`cpf.eq.${cleanCpf},cpf.eq.${formattedCpf}`)

    if (excludeIdLeitor) {
      query = query.neq('id_leitor', excludeIdLeitor)
    }

    const { data, error } = await query
    if (error) throw error
    return (data || []).length > 0
  },

  async create(leitor: LeitorInsert) {
    const { data, error } = await supabase
      .from('leitor')
      .insert({
        ...leitor,
        data_cadastro: leitor.data_cadastro || new Date().toISOString().split('T')[0],
        bloqueado: leitor.bloqueado ?? false,
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  async update(id_leitor: number, updates: LeitorUpdate) {
    const { data, error } = await supabase
      .from('leitor')
      .update(updates)
      .eq('id_leitor', id_leitor)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async toggleBlock(id_leitor: number, currentBlocked: boolean) {
    const { data, error } = await supabase
      .from('leitor')
      .update({ bloqueado: !currentBlocked })
      .eq('id_leitor', id_leitor)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async delete(id_leitor: number) {
    // 1. Contagem total de empréstimos vinculados ao leitor (ativos + históricos)
    const { count: totalCount, error: countError } = await supabase
      .from('emprestimo')
      .select('id_emprestimo', { count: 'exact', head: true })
      .eq('id_leitor', id_leitor)

    if (countError) throw countError

    if (totalCount !== null && totalCount > 0) {
      // Verificar se há empréstimos ativos pendentes
      const { data: activeLoans, error: activeError } = await supabase
        .from('emprestimo')
        .select('id_emprestimo')
        .eq('id_leitor', id_leitor)
        .is('data_devolucao_real', null)

      if (activeError) throw activeError

      if (activeLoans && activeLoans.length > 0) {
        throw new Error('Não é possível remover leitor com empréstimos ativos pendentes.')
      } else {
        throw new Error(
          'Este leitor possui histórico de empréstimos e não pode ser excluído. Considere bloqueá-lo para impedir novos empréstimos.',
        )
      }
    }

    const { error } = await supabase.from('leitor').delete().eq('id_leitor', id_leitor)
    if (error) throw error
  },
}
