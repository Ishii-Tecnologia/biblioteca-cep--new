import { supabase } from '@/lib/supabase/client'
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/supabase/types'
import { HistoricoService } from './historico'

export type Exemplar = Tables<'exemplar'>
export type ExemplarInsert = TablesInsert<'exemplar'>
export type ExemplarUpdate = TablesUpdate<'exemplar'>

export interface ExemplarWithTitulo extends Exemplar {
  titulo?: Tables<'titulo'>
  ultimo_emprestimo?: {
    id_emprestimo: number
    id_leitor: number
    data_emprestimo: string
    data_prevista_devolucao: string
    leitor?: {
      nome_do_leitor: string
      email: string
    }
  }
}

export const ExemplaresService = {
  async getByTitulo(id_titulo: string) {
    const { data, error } = await supabase
      .from('exemplar')
      .select('*')
      .eq('id_titulo', id_titulo)
      .order('seq', { ascending: true })

    if (error) throw error
    return data
  },

  async getAll(statusFilter?: string) {
    let query = supabase
      .from('exemplar')
      .select('*, titulo(*)')
      .order('id_exemplar', { ascending: true })

    if (statusFilter && statusFilter !== 'all') {
      if (statusFilter === 'Manutencao' || statusFilter === 'EM_MANUTENCAO') {
        query = query.in('status', ['Manutencao', 'EM_MANUTENCAO', 'Em Manutencao'])
      } else {
        query = query.eq('status', statusFilter)
      }
    }

    const { data, error } = await query
    if (error) throw error
    return data
  },

  async create(id_titulo: string, localizacao = 'Estante Geral', quantidade = 1) {
    const { data: existing } = await supabase
      .from('exemplar')
      .select('seq')
      .eq('id_titulo', id_titulo)
      .order('seq', { ascending: false })
      .limit(1)

    const startSeq = existing && existing.length > 0 ? existing[0].seq + 1 : 1
    const inserts: ExemplarInsert[] = []

    for (let i = 0; i < quantidade; i++) {
      const seq = startSeq + i
      inserts.push({
        id_exemplar: `${id_titulo}-${seq}`,
        id_titulo: id_titulo,
        seq: seq,
        status: 'Disponivel',
        localizacao: localizacao,
      })
    }

    const { data, error } = await supabase.from('exemplar').insert(inserts).select()
    if (error) throw error
    return data
  },

  /**
   * Atualiza o status do exemplar com registro no Histórico Geral de Operações (F-03)
   */
  async updateStatus(
    id_exemplar: string,
    status: string,
    localizacao?: string,
    observacao?: string,
    operatorName = 'Sistema',
  ) {
    // Normalizar status para Manutencao
    const finalStatus = status === 'EM_MANUTENCAO' ? 'Manutencao' : status

    const updateObj: ExemplarUpdate = { status: finalStatus }
    if (localizacao !== undefined) {
      updateObj.localizacao = localizacao
    }

    // Buscar título para log rico
    const { data: currentEx } = await supabase
      .from('exemplar')
      .select('*, titulo(titulo_de_livro, autor)')
      .eq('id_exemplar', id_exemplar)
      .single()

    const { data, error } = await supabase
      .from('exemplar')
      .update(updateObj)
      .eq('id_exemplar', id_exemplar)
      .select()
      .single()

    if (error) throw error

    // F-03: Registrar evento de manutenção no Histórico Geral
    try {
      const bookTitle = (currentEx?.titulo as any)?.titulo_de_livro || id_exemplar
      const obsText = observacao?.trim() ? ` — Motivo: ${observacao.trim()}` : ''

      if (finalStatus === 'Manutencao') {
        await HistoricoService.log(
          id_exemplar,
          'Entrada em Manutenção',
          null,
          `Exemplar ${id_exemplar} ("${bookTitle}") enviado para manutenção física${obsText}`,
          operatorName,
          'exemplar',
        )
      } else if (currentEx?.status === 'Manutencao' && finalStatus === 'Disponivel') {
        await HistoricoService.log(
          id_exemplar,
          'Saída de Manutenção',
          null,
          `Exemplar ${id_exemplar} ("${bookTitle}") liberado da manutenção para disponibilidade${obsText}`,
          operatorName,
          'exemplar',
        )
      } else if (finalStatus === 'Perdido') {
        await HistoricoService.log(
          id_exemplar,
          'Baixa / Perdido',
          null,
          `Exemplar ${id_exemplar} ("${bookTitle}") baixado do acervo como perdido/danificado${obsText}`,
          operatorName,
          'exemplar',
        )
      }
    } catch (logErr) {
      console.warn('Erro ao registrar log de manutenção no histórico:', logErr)
    }

    return data
  },

  async delete(id_exemplar: string) {
    const { data: loan } = await supabase
      .from('emprestimo')
      .select('id_emprestimo')
      .eq('id_exemplar', id_exemplar)
      .is('data_devolucao_real', null)
      .maybeSingle()

    if (loan) {
      throw new Error('Não é possível remover um exemplar que está atualmente emprestado.')
    }

    const { error } = await supabase.from('exemplar').delete().eq('id_exemplar', id_exemplar)
    if (error) throw error
  },
}
