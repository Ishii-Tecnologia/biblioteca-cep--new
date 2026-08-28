import { supabase } from '@/lib/supabase/client'
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/supabase/types'

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
      query = query.eq('status', statusFilter)
    }

    const { data, error } = await query
    if (error) throw error
    return data
  },

  async create(id_titulo: string, localizacao = 'Estante Geral', quantidade = 1) {
    // Find highest sequence
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

  async updateStatus(id_exemplar: string, status: string, localizacao?: string) {
    const updateObj: ExemplarUpdate = { status }
    if (localizacao !== undefined) {
      updateObj.localizacao = localizacao
    }

    const { data, error } = await supabase
      .from('exemplar')
      .update(updateObj)
      .eq('id_exemplar', id_exemplar)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async delete(id_exemplar: string) {
    // Check if on loan
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
