import { supabase } from '@/lib/supabase/client'

export type AuthorType = 'ESPIRITO' | 'ENCARNADO' | 'MEDIUM' | 'OUTRO'

export interface Author {
  id: string
  name: string
  type: AuthorType
  created_at: string
}

export const AuthorsService = {
  /**
   * Busca autores com autocompletar incremental (mínimo 2 caracteres sugerido)
   * Case-insensitive, ordenado por relevância e nome, limitado a ~15 resultados
   */
  async search(query: string, type?: AuthorType, limit = 15): Promise<Author[]> {
    let req = (supabase.from('authors' as any) as any)
      .select('*')
      .order('name', { ascending: true })
      .limit(limit)

    if (query && query.trim().length >= 1) {
      req = req.ilike('name', `%${query.trim()}%`)
    }

    if (type) {
      req = req.eq('type', type)
    }

    const { data, error } = await req
    if (error) {
      console.warn('Erro ao buscar autores:', error)
      return []
    }
    return (data || []) as Author[]
  },

  /**
   * Retorna os autores mais frequentes / populares
   */
  async getPopular(type?: AuthorType, limit = 20): Promise<Author[]> {
    let req = (supabase.from('authors' as any) as any)
      .select('*')
      .order('name', { ascending: true })
      .limit(limit)

    if (type) {
      req = req.eq('type', type)
    }

    const { data, error } = await req
    if (error) {
      console.warn('Erro ao obter autores populares:', error)
      return []
    }
    return (data || []) as Author[]
  },

  /**
   * Cria ou busca autor inline para não quebrar fluxo
   */
  async findOrCreate(name: string, type: AuthorType = 'ENCARNADO'): Promise<Author> {
    const trimmed = name.trim()
    if (!trimmed) {
      throw new Error('Nome do autor não pode ser vazio.')
    }

    // Tentar localizar existente case-insensitive
    const { data: existing } = await (supabase.from('authors' as any) as any)
      .select('*')
      .ilike('name', trimmed)
      .eq('type', type)
      .maybeSingle()

    if (existing) {
      return existing as Author
    }

    // Inserir novo autor
    const { data, error } = await (supabase.from('authors' as any) as any)
      .insert({
        name: trimmed,
        type: type,
      })
      .select()
      .single()

    if (error) {
      // Caso conflito simultâneo, buscar novamente
      const { data: fallback } = await (supabase.from('authors' as any) as any)
        .select('*')
        .ilike('name', trimmed)
        .eq('type', type)
        .single()
      if (fallback) return fallback as Author
      throw error
    }

    return data as Author
  },
}
