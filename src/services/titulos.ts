import { supabase } from '@/lib/supabase/client'
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/supabase/types'

export type Titulo = Tables<'titulo'>
export type TituloInsert = TablesInsert<'titulo'>
export type TituloUpdate = TablesUpdate<'titulo'>

export interface TituloWithStats extends Titulo {
  total_exemplares: number
  exemplares_disponiveis: number
  exemplares_emprestados: number
  exemplares_manutencao: number
}

export const TitulosService = {
  async getAll(searchQuery?: string, category?: string, onlyActive = true) {
    let query = supabase
      .from('titulo')
      .select('*, exemplar(id_exemplar, seq, status, localizacao)')
      .order('titulo_de_livro', { ascending: true })

    if (onlyActive) {
      query = query.eq('ativo', true)
    }

    if (category && category !== 'all') {
      query = query.eq('categoria', category)
    }

    if (searchQuery && searchQuery.trim()) {
      const q = `%${searchQuery.trim()}%`
      query = query.or(
        `titulo_de_livro.ilike.${q},autor.ilike.${q},editora.ilike.${q},isbn.ilike.${q},id_titulo.ilike.${q}`,
      )
    }

    const { data, error } = await query
    if (error) throw error

    const formatted: TituloWithStats[] = (data || []).map((item: any) => {
      const exemplares = item.exemplar || []
      const total = exemplares.length
      const disponiveis = exemplares.filter((e: any) => e.status === 'Disponivel').length
      const emprestados = exemplares.filter((e: any) => e.status === 'Emprestado').length
      const manutencao = exemplares.filter(
        (e: any) => e.status === 'Manutencao' || e.status === 'Perdido',
      ).length

      return {
        id_titulo: item.id_titulo,
        titulo_de_livro: item.titulo_de_livro,
        autor: item.autor,
        editora: item.editora,
        ano_publicacao: item.ano_publicacao,
        isbn: item.isbn,
        categoria: item.categoria,
        sinopse: item.sinopse || null,
        vol: item.vol || 0,
        capa_url: item.capa_url,
        ativo: item.ativo,
        created_at: item.created_at,
        total_exemplares: total,
        exemplares_disponiveis: disponiveis,
        exemplares_emprestados: emprestados,
        exemplares_manutencao: manutencao,
      }
    })

    return formatted
  },

  async getById(id_titulo: string) {
    const { data, error } = await supabase
      .from('titulo')
      .select('*, exemplar(*)')
      .eq('id_titulo', id_titulo)
      .single()

    if (error) throw error
    return data
  },

  async generateId(autor: string, titulo: string): Promise<string> {
    try {
      const { data, error } = await supabase.rpc('gerar_id_titulo', {
        p_autor: autor,
        p_titulo: titulo || '',
      })
      if (error || !data) {
        // Fallback generator
        const clean = autor.replace(/[^a-zA-Z]/g, '').toUpperCase()
        const code = clean.length >= 2 ? clean.substring(0, 2) : (clean + 'XX').substring(0, 2)
        const randomNum = Math.floor(100 + Math.random() * 900)
        return `${code}-${randomNum}`
      }
      return data
    } catch {
      const clean = autor.replace(/[^a-zA-Z]/g, '').toUpperCase()
      const code = clean.length >= 2 ? clean.substring(0, 2) : (clean + 'XX').substring(0, 2)
      const randomNum = Math.floor(100 + Math.random() * 900)
      return `${code}-${randomNum}`
    }
  },

  async create(titulo: TituloInsert, numExemplares = 1, localizacaoPadrao = 'Estante Geral') {
    let id_titulo = titulo.id_titulo
    if (!id_titulo || !id_titulo.trim()) {
      id_titulo = await this.generateId(titulo.autor, titulo.titulo_de_livro)
    }

    const newTitulo: TituloInsert = {
      ...titulo,
      id_titulo: id_titulo.toUpperCase().trim(),
      vol: titulo.vol || 0,
      ativo: titulo.ativo ?? true,
    }

    const { data, error } = await supabase.from('titulo').insert(newTitulo).select().single()
    if (error) throw error

    // Create copies if requested
    if (numExemplares > 0) {
      const exemplaresToInsert = []
      for (let seq = 1; seq <= numExemplares; seq++) {
        exemplaresToInsert.push({
          id_exemplar: `${data.id_titulo}-${seq}`,
          id_titulo: data.id_titulo,
          seq: seq,
          status: 'Disponivel',
          localizacao: localizacaoPadrao,
        })
      }
      await supabase.from('exemplar').insert(exemplaresToInsert)
    }

    return data
  },

  async update(id_titulo: string, updates: TituloUpdate) {
    const { data, error } = await supabase
      .from('titulo')
      .update(updates)
      .eq('id_titulo', id_titulo)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async delete(id_titulo: string) {
    // Check if there are active loans
    const { data: exemplares } = await supabase
      .from('exemplar')
      .select('id_exemplar')
      .eq('id_titulo', id_titulo)

    if (exemplares && exemplares.length > 0) {
      const exemplarIds = exemplares.map((e) => e.id_exemplar)
      const { data: activeLoans } = await supabase
        .from('emprestimo')
        .select('id_emprestimo')
        .in('id_exemplar', exemplarIds)
        .is('data_devolucao_real', null)

      if (activeLoans && activeLoans.length > 0) {
        throw new Error('Não é possível excluir título com empréstimos em andamento.')
      }

      // Delete exemplares first
      await supabase.from('exemplar').delete().eq('id_titulo', id_titulo)
    }

    const { error } = await supabase.from('titulo').delete().eq('id_titulo', id_titulo)
    if (error) throw error
  },

  async getCategories(): Promise<string[]> {
    const { data: catData } = await (supabase.from('categorias' as any) as any)
      .select('nome')
      .order('nome', { ascending: true })
    if (catData && catData.length > 0) {
      return catData.map((c: any) => c.nome)
    }

    // Fallback: buscar das obras caso categorias esteja vazio
    const { data } = await supabase.from('titulo').select('categoria')
    if (!data) return []
    const categories = new Set<string>()
    data.forEach((item) => {
      if (item.categoria && item.categoria.trim()) categories.add(item.categoria.trim())
    })
    return Array.from(categories).sort()
  },
}
