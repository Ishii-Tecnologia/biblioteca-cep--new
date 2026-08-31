import { supabase } from '@/lib/supabase/client'
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/supabase/types'
import { normalizeAndValidateIsbn, formatAuthorDisplay } from './isbn'

export type Titulo = Tables<'titulo'> & {
  autor_espiritual?: string | null
  autor_mediunico?: string | null
  author_id?: string | null
}

export type TituloInsert = TablesInsert<'titulo'> & {
  autor_espiritual?: string | null
  autor_mediunico?: string | null
  author_id?: string | null
}

export type TituloUpdate = TablesUpdate<'titulo'> & {
  autor_espiritual?: string | null
  autor_mediunico?: string | null
  author_id?: string | null
}

export interface TituloWithStats extends Titulo {
  total_exemplares: number
  exemplares_disponiveis: number
  exemplares_emprestados: number
  exemplares_manutencao: number
  autor_formatado: string
}

export interface TotaisAcervo {
  totalTitulos: number
  totalExemplares: number
  totalDisponiveis: number
  totalEmprestados: number
  totalManutencao: number
  totalPerdidos: number
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
        `titulo_de_livro.ilike.${q},autor.ilike.${q},autor_espiritual.ilike.${q},autor_mediunico.ilike.${q},editora.ilike.${q},isbn.ilike.${q},id_titulo.ilike.${q}`,
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
        (e: any) =>
          e.status === 'Manutencao' ||
          e.status === 'EM_MANUTENCAO' ||
          e.status === 'Em Manutencao' ||
          e.status === 'Perdido',
      ).length

      const autorFormatado = formatAuthorDisplay(
        item.autor_espiritual,
        item.autor_mediunico,
        item.autor,
      )

      return {
        id_titulo: item.id_titulo,
        titulo_de_livro: item.titulo_de_livro,
        autor: item.autor,
        autor_espiritual: item.autor_espiritual || null,
        autor_mediunico: item.autor_mediunico || null,
        author_id: item.author_id || null,
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
        autor_formatado: autorFormatado,
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

  async getTotais(): Promise<TotaisAcervo> {
    const [{ count: totalTitulos, error: titErr }, { data: exemplares, error: exErr }] =
      await Promise.all([
        supabase.from('titulo').select('*', { count: 'exact', head: true }).eq('ativo', true),
        supabase.from('exemplar').select('status'),
      ])

    if (titErr) throw titErr
    if (exErr) throw exErr

    const allEx = exemplares || []
    const totalExemplares = allEx.length
    const totalDisponiveis = allEx.filter((e) => e.status === 'Disponivel').length
    const totalEmprestados = allEx.filter((e) => e.status === 'Emprestado').length
    const totalManutencao = allEx.filter(
      (e) =>
        e.status === 'Manutencao' || e.status === 'EM_MANUTENCAO' || e.status === 'Em Manutencao',
    ).length
    const totalPerdidos = allEx.filter((e) => e.status === 'Perdido').length

    return {
      totalTitulos: totalTitulos || 0,
      totalExemplares,
      totalDisponiveis,
      totalEmprestados,
      totalManutencao,
      totalPerdidos,
    }
  },

  async generateId(autor: string, titulo: string): Promise<string> {
    try {
      const { data, error } = await supabase.rpc('gerar_id_titulo', {
        p_autor: autor,
        p_titulo: titulo || '',
      })
      if (error || !data) {
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

  /**
   * Verifica se o ISBN já está cadastrado em outro livro (unicidade)
   */
  async checkIsbnExists(isbn: string, excludeIdTitulo?: string): Promise<boolean> {
    const val = normalizeAndValidateIsbn(isbn)
    const clean = val.valid ? val.isbn13 : isbn.trim()

    let q = supabase.from('titulo').select('id_titulo').eq('isbn', clean)
    if (excludeIdTitulo) {
      q = q.neq('id_titulo', excludeIdTitulo)
    }
    const { data, error } = await q.maybeSingle()
    if (error) return false
    return !!data
  },

  async create(titulo: TituloInsert, numExemplares = 1, localizacaoPadrao = 'Estante Geral') {
    // F-09: ISBN obrigatório para novos cadastros com validação de formato e unicidade
    if (!titulo.isbn || !titulo.isbn.trim()) {
      throw new Error('O código ISBN é obrigatório para novos cadastros no acervo.')
    }

    const isbnValidation = normalizeAndValidateIsbn(titulo.isbn)
    if (!isbnValidation.valid) {
      throw new Error(
        isbnValidation.error || 'ISBN inválido. Informe um ISBN-10 ou ISBN-13 válido.',
      )
    }
    const normalizedIsbn = isbnValidation.isbn13

    // Checar unicidade
    const alreadyExists = await this.checkIsbnExists(normalizedIsbn)
    if (alreadyExists) {
      throw new Error(`O ISBN ${normalizedIsbn} já está cadastrado em outra obra no catálogo.`)
    }

    let id_titulo = titulo.id_titulo
    const authorForId = titulo.autor_espiritual || titulo.autor || 'XX'
    if (!id_titulo || !id_titulo.trim()) {
      id_titulo = await this.generateId(authorForId, titulo.titulo_de_livro)
    }

    // Compor campo autor unificado
    const autorUnificado = formatAuthorDisplay(
      titulo.autor_espiritual,
      titulo.autor_mediunico,
      titulo.autor,
    )

    const newTitulo: any = {
      ...titulo,
      id_titulo: id_titulo.toUpperCase().trim(),
      autor: autorUnificado,
      autor_espiritual: titulo.autor_espiritual?.trim() || null,
      autor_mediunico: titulo.autor_mediunico?.trim() || null,
      author_id: titulo.author_id || null,
      isbn: normalizedIsbn,
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
    let normalizedIsbn = updates.isbn
    if (updates.isbn && updates.isbn.trim()) {
      const isbnValidation = normalizeAndValidateIsbn(updates.isbn)
      if (!isbnValidation.valid) {
        throw new Error(isbnValidation.error || 'ISBN inválido.')
      }
      normalizedIsbn = isbnValidation.isbn13

      const alreadyExists = await this.checkIsbnExists(normalizedIsbn, id_titulo)
      if (alreadyExists) {
        throw new Error(`O ISBN ${normalizedIsbn} já pertence a outro livro.`)
      }
    }

    const finalAutor = formatAuthorDisplay(
      updates.autor_espiritual,
      updates.autor_mediunico,
      updates.autor,
    )

    const updatePayload: any = {
      ...updates,
      autor: finalAutor,
      autor_espiritual:
        updates.autor_espiritual !== undefined
          ? updates.autor_espiritual?.trim() || null
          : undefined,
      autor_mediunico:
        updates.autor_mediunico !== undefined ? updates.autor_mediunico?.trim() || null : undefined,
      isbn: normalizedIsbn,
    }

    const { data, error } = await supabase
      .from('titulo')
      .update(updatePayload)
      .eq('id_titulo', id_titulo)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async delete(id_titulo: string) {
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

    const { data } = await supabase.from('titulo').select('categoria')
    if (!data) return []
    const categories = new Set<string>()
    data.forEach((item) => {
      if (item.categoria && item.categoria.trim()) categories.add(item.categoria.trim())
    })
    return Array.from(categories).sort()
  },
}
