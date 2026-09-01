import { supabase } from '@/lib/supabase/client'
import type { Tables } from '@/lib/supabase/types'
import { HistoricoService } from './historico'

export type Reserva = Tables<'reserva'>

export interface ReservaDetailed {
  id_reserva: number
  id_titulo: string
  id_leitor: number
  data_reserva: string
  status_reserva: 'Ativa' | 'Atendida' | 'Cancelada'
  data_atendimento: string | null
  titulo?: {
    titulo_de_livro: string
    autor: string
    categoria?: string
    capa_url?: string
  }
  leitor?: {
    nome_do_leitor: string
    email: string
    telefone?: string
    bloqueado?: boolean
  }
}

export const ReservasService = {
  async getAll(statusFilter = 'Ativa') {
    let query = supabase
      .from('reserva')
      .select(`
        *,
        titulo:id_titulo(
          titulo_de_livro,
          autor,
          categoria,
          capa_url
        ),
        leitor:id_leitor(
          nome_do_leitor,
          email,
          telefone,
          bloqueado
        )
      `)
      .order('data_reserva', { ascending: true })

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status_reserva', statusFilter)
    }

    const { data, error } = await query
    if (error) throw error
    return (data || []) as unknown as ReservaDetailed[]
  },

  /**
   * Busca reservas de um leitor específico (ou de um usuário autenticado)
   */
  async getByLeitor(id_leitor: number, statusFilter = 'all') {
    let query = supabase
      .from('reserva')
      .select(`
        *,
        titulo:id_titulo(
          titulo_de_livro,
          autor,
          categoria,
          capa_url
        ),
        leitor:id_leitor(
          nome_do_leitor,
          email,
          telefone,
          bloqueado
        )
      `)
      .eq('id_leitor', id_leitor)
      .order('data_reserva', { ascending: false })

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status_reserva', statusFilter)
    }

    const { data, error } = await query
    if (error) throw error
    return (data || []) as unknown as ReservaDetailed[]
  },

  /**
   * Conta reservas ativas pendentes para badge no cabeçalho (F-02)
   */
  async countActive(): Promise<number> {
    const { count, error } = await supabase
      .from('reserva')
      .select('*', { count: 'exact', head: true })
      .eq('status_reserva', 'Ativa')

    if (error) return 0
    return count ?? 0
  },

  async create(id_titulo: string, id_leitor: number, operatorName?: string) {
    // Regra F-08: Verificar se o livro possui exemplares disponíveis antes de reservar
    // (Apenas permitir reserva se todos os exemplares estiverem emprestados ou em manutenção)
    const { data: exemplares } = await supabase
      .from('exemplar')
      .select('id_exemplar, status')
      .eq('id_titulo', id_titulo)

    const disponiveis = (exemplares || []).filter((e) => e.status === 'Disponivel')
    if (disponiveis.length > 0) {
      throw new Error(
        'Esta obra possui exemplar(es) disponível(is) na biblioteca. Realize o empréstimo direto em vez de reservar.',
      )
    }

    // Regra F-08: Limite de 3 reservas ativas por usuário
    const { count: userActiveReservas } = await supabase
      .from('reserva')
      .select('*', { count: 'exact', head: true })
      .eq('id_leitor', id_leitor)
      .eq('status_reserva', 'Ativa')

    if ((userActiveReservas || 0) >= 3) {
      throw new Error('Limite máximo de 3 reservas ativas simultâneas atingido para este leitor.')
    }

    // 1. Check if user already has an active reservation for this book
    const { data: existing } = await supabase
      .from('reserva')
      .select('id_reserva')
      .eq('id_titulo', id_titulo)
      .eq('id_leitor', id_leitor)
      .eq('status_reserva', 'Ativa')
      .maybeSingle()

    if (existing) {
      throw new Error('Você já possui uma reserva ativa na fila para esta obra.')
    }

    // 1.1 Verificar se o leitor já possui exemplar deste título emprestado
    const { data: emprestimosAtivosDoLeitor } = await supabase
      .from('emprestimo')
      .select('id_emprestimo, exemplar!inner(id_titulo)')
      .eq('id_leitor', id_leitor)
      .is('data_devolucao_real', null)
      .eq('exemplar.id_titulo', id_titulo)

    if (emprestimosAtivosDoLeitor && emprestimosAtivosDoLeitor.length > 0) {
      throw new Error('Você já possui um exemplar desta mesma obra emprestado atualmente.')
    }

    // 2. Check reader not blocked
    const { data: reader } = await supabase
      .from('leitor')
      .select('bloqueado, nome_do_leitor')
      .eq('id_leitor', id_leitor)
      .single()

    if (reader?.bloqueado) {
      throw new Error('Leitor com cadastro bloqueado não pode solicitar reservas.')
    }

    // 3. Buscar título para descrição rica
    const { data: tituloData } = await supabase
      .from('titulo')
      .select('titulo_de_livro')
      .eq('id_titulo', id_titulo)
      .single()

    const tituloNome = tituloData?.titulo_de_livro || id_titulo
    const leitorNome = reader?.nome_do_leitor || `Leitor #${id_leitor}`

    const { data, error } = await supabase
      .from('reserva')
      .insert({
        id_titulo,
        id_leitor,
        status_reserva: 'Ativa',
        data_reserva: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error

    // Registrar no histórico
    try {
      await HistoricoService.log(
        id_titulo,
        'Reserva Criada',
        id_leitor,
        `Reserva da obra "${tituloNome}" solicitada para o leitor ${leitorNome}`,
        operatorName || 'Sistema',
        'titulo',
      )
    } catch (logErr) {
      console.warn('Erro ao registrar log de reserva criada:', logErr)
    }

    return data
  },

  async cancel(id_reserva: number, operatorName?: string) {
    const { data: reserva } = await supabase
      .from('reserva')
      .select(`
        id_reserva,
        id_titulo,
        id_leitor,
        titulo:id_titulo(titulo_de_livro),
        leitor:id_leitor(nome_do_leitor)
      `)
      .eq('id_reserva', id_reserva)
      .single()

    const { data, error } = await supabase
      .from('reserva')
      .update({ status_reserva: 'Cancelada' })
      .eq('id_reserva', id_reserva)
      .select()
      .single()

    if (error) throw error

    // Registrar no histórico
    if (reserva) {
      const bookTitle = (reserva.titulo as any)?.titulo_de_livro || reserva.id_titulo
      const readerName = (reserva.leitor as any)?.nome_do_leitor || `Leitor #${reserva.id_leitor}`
      try {
        await HistoricoService.log(
          reserva.id_titulo,
          'Reserva Cancelada',
          reserva.id_leitor,
          `Reserva #${id_reserva} da obra "${bookTitle}" para o leitor ${readerName} foi cancelada`,
          operatorName || 'Sistema',
          'titulo',
        )
      } catch (logErr) {
        console.warn('Erro ao registrar log de reserva cancelada:', logErr)
      }
    }

    return data
  },

  async fulfill(id_reserva: number, operatorName = 'Sistema') {
    // 1. Get reservation details
    const { data: reservaData, error: resErr } = await supabase
      .from('reserva')
      .select(`
        *,
        titulo:id_titulo(titulo_de_livro),
        leitor:id_leitor(nome_do_leitor)
      `)
      .eq('id_reserva', id_reserva)
      .single()

    if (resErr || !reservaData) {
      throw new Error('Reserva não encontrada.')
    }

    // 2. Find an available or reserved copy of this title
    const { data: exemplares, error: exErr } = await supabase
      .from('exemplar')
      .select('id_exemplar, status')
      .eq('id_titulo', reservaData.id_titulo)
      .in('status', ['Disponivel', 'Reservado'])
      .limit(1)

    if (exErr) throw exErr

    const copyToUse = exemplares && exemplares.length > 0 ? exemplares[0] : null

    if (!copyToUse) {
      throw new Error('Nenhum exemplar disponível para atender esta reserva no momento.')
    }

    // 3. Mark reservation as Atendida
    const { data, error } = await supabase
      .from('reserva')
      .update({
        status_reserva: 'Atendida',
        data_atendimento: new Date().toISOString(),
      })
      .eq('id_reserva', id_reserva)
      .select()
      .single()

    if (error) throw error

    // 4. Create loan
    const now = new Date()
    const expected = new Date()
    expected.setDate(now.getDate() + 15)

    const { error: loanErr } = await supabase.from('emprestimo').insert({
      id_exemplar: copyToUse.id_exemplar,
      id_leitor: reservaData.id_leitor,
      data_emprestimo: now.toISOString(),
      data_prevista_devolucao: expected.toISOString(),
      atraso: false,
    })

    if (loanErr) throw loanErr

    // 5. Update copy status to Emprestado
    await supabase
      .from('exemplar')
      .update({ status: 'Emprestado' })
      .eq('id_exemplar', copyToUse.id_exemplar)

    // 6. Registrar log no HistoricoService
    try {
      const bookTitle = (reservaData.titulo as any)?.titulo_de_livro || reservaData.id_titulo
      const readerName =
        (reservaData.leitor as any)?.nome_do_leitor || `Leitor #${reservaData.id_leitor}`

      await HistoricoService.log(
        copyToUse.id_exemplar,
        'Reserva Atendida',
        reservaData.id_leitor,
        `Reserva #${id_reserva} atendida: exemplar ${copyToUse.id_exemplar} ("${bookTitle}") emprestado para o leitor ${readerName}`,
        operatorName,
        'exemplar',
      )
    } catch (logError) {
      console.warn('Erro ao registrar log da reserva atendida:', logError)
    }

    return data
  },
}
