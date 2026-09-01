import { supabase } from '@/lib/supabase/client'
import { HistoricoService } from './historico'
import { getTempoReservaGarantidaHoras } from './parametros'

export interface ReservaDetailed {
  id_reserva: number
  id_titulo: string
  id_leitor: number
  data_reserva: string
  status_reserva: 'Ativa' | 'Pronta para Retirada' | 'Atendida' | 'Cancelada' | 'Expirada'
  data_atendimento: string | null
  ordem_fila?: number
  data_limite_retirada?: string | null
  exemplar_reservado_id?: string | null
  notificacao_enviada?: boolean
  data_notificacao?: string | null
  posicao_fila?: number
  total_fila?: number
  data_estimada_disponibilidade?: string | null
  horas_restantes_garantida?: number | null
  historico_evento?: {
    tipo: string
    descricao: string
    created_at: string
    observacao?: string | null
  } | null
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

export interface FilaItemAdmin {
  id_reserva: number
  id_titulo: string
  id_leitor: number
  data_reserva: string
  status_reserva: string
  ordem_fila: number
  posicao: number
  data_limite_retirada?: string | null
  exemplar_reservado_id?: string | null
  leitor_nome: string
  leitor_email: string
  leitor_telefone?: string
}

export const ReservasService = {
  /**
   * Busca todas as reservas
   */
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
      if (statusFilter === 'Ativa') {
        query = query.in('status_reserva', ['Ativa', 'Pronta para Retirada'])
      } else {
        query = query.eq('status_reserva', statusFilter)
      }
    }

    const { data, error } = await query
    if (error) throw error
    return ReservasService.enrichReservations((data || []) as unknown as ReservaDetailed[])
  },

  /**
   * Busca reservas de um leitor específico
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
      if (statusFilter === 'Ativa') {
        query = query.in('status_reserva', ['Ativa', 'Pronta para Retirada'])
      } else {
        query = query.eq('status_reserva', statusFilter)
      }
    }

    const { data, error } = await query
    if (error) throw error
    return ReservasService.enrichReservations((data || []) as unknown as ReservaDetailed[])
  },

  /**
   * Obtém a fila completa e ordenada de leitores para um livro específico (Visão Admin)
   */
  async getQueueByBook(id_titulo: string): Promise<FilaItemAdmin[]> {
    const { data, error } = await (supabase.from('reserva') as any)
      .select(`
        *,
        leitor:id_leitor (
          nome_do_leitor,
          email,
          telefone
        )
      `)
      .eq('id_titulo', id_titulo)
      .in('status_reserva', ['Ativa', 'Pronta para Retirada'])
      .order('ordem_fila', { ascending: true })
      .order('data_reserva', { ascending: true })

    if (error) throw error

    return (data || []).map((item: any, index: number) => ({
      id_reserva: item.id_reserva,
      id_titulo: item.id_titulo,
      id_leitor: item.id_leitor,
      data_reserva: item.data_reserva,
      status_reserva: item.status_reserva,
      ordem_fila: item.ordem_fila || index + 1,
      posicao: index + 1,
      data_limite_retirada: item.data_limite_retirada,
      exemplar_reservado_id: item.exemplar_reservado_id,
      leitor_nome: item.leitor?.nome_do_leitor || `Leitor #${item.id_leitor}`,
      leitor_email: item.leitor?.email || '',
      leitor_telefone: item.leitor?.telefone || '',
    }))
  },

  /**
   * Enriquece as reservas com posição na fila, data estimada de disponibilidade e tempo de reserva garantida
   */
  async enrichReservations(items: ReservaDetailed[]): Promise<ReservaDetailed[]> {
    if (!items || items.length === 0) return []

    const uniqueTitulos = Array.from(new Set(items.map((i) => i.id_titulo)))
    let activeQueueByTitulo: Record<
      string,
      { id_reserva: number; data_reserva: string; ordem_fila?: number }[]
    > = {}

    let expectedReturnsByTitulo: Record<string, Date[]> = {}

    if (uniqueTitulos.length > 0) {
      // 1. Fila de reservas ativas
      const { data: allActive } = await (supabase.from('reserva') as any)
        .select('id_reserva, id_titulo, data_reserva, ordem_fila, status_reserva')
        .in('id_titulo', uniqueTitulos)
        .in('status_reserva', ['Ativa', 'Pronta para Retirada'])
        .order('ordem_fila', { ascending: true })
        .order('data_reserva', { ascending: true })

      if (allActive) {
        for (const act of allActive as any[]) {
          if (!activeQueueByTitulo[act.id_titulo]) {
            activeQueueByTitulo[act.id_titulo] = []
          }
          activeQueueByTitulo[act.id_titulo].push({
            id_reserva: act.id_reserva,
            data_reserva: act.data_reserva,
            ordem_fila: act.ordem_fila || 0,
          })
        }
      }

      // 2. Empréstimos ativos e datas previstas de devolução
      const { data: activeLoans } = await supabase
        .from('emprestimo')
        .select('id_emprestimo, id_exemplar, data_prevista_devolucao, exemplar!inner(id_titulo)')
        .in('exemplar.id_titulo', uniqueTitulos)
        .is('data_devolucao_real', null)
        .order('data_prevista_devolucao', { ascending: true })

      if (activeLoans) {
        for (const loan of activeLoans) {
          const titId = (loan.exemplar as any)?.id_titulo
          if (titId && loan.data_prevista_devolucao) {
            if (!expectedReturnsByTitulo[titId]) {
              expectedReturnsByTitulo[titId] = []
            }
            expectedReturnsByTitulo[titId].push(new Date(loan.data_prevista_devolucao))
          }
        }
      }
    }

    // 3. Buscar histórico para eventos de atendimento/cancelamento
    const { data: logs } = await supabase
      .from('historico')
      .select('id, tipo, descricao, created_at, observacao')
      .ilike('tipo', 'Reserva%')
      .order('created_at', { ascending: false })
      .limit(200)

    const historicoMap: Record<
      number,
      { tipo: string; descricao: string; created_at: string; observacao?: string | null }
    > = {}

    if (logs) {
      for (const log of logs) {
        const match = log.descricao?.match(/Reserva #(\d+)/i)
        if (match && match[1]) {
          const resId = parseInt(match[1], 10)
          if (!historicoMap[resId]) {
            historicoMap[resId] = {
              tipo: log.tipo,
              descricao: log.descricao,
              created_at: log.created_at,
              observacao: log.observacao,
            }
          }
        }
      }
    }

    const now = new Date()

    return items.map((res) => {
      let posicao_fila: number | undefined
      let total_fila: number | undefined
      let data_estimada_disponibilidade: string | null = null
      let horas_restantes_garantida: number | null = null

      if (res.status_reserva === 'Ativa' || res.status_reserva === 'Pronta para Retirada') {
        const queue = activeQueueByTitulo[res.id_titulo] || []
        const idx = queue.findIndex((q) => q.id_reserva === res.id_reserva)
        if (idx !== -1) {
          posicao_fila = idx + 1
          total_fila = queue.length
        } else {
          posicao_fila = 1
          total_fila = 1
        }

        // Estimar data de disponibilidade baseada na posição na fila e devoluções previstas
        const returns = expectedReturnsByTitulo[res.id_titulo] || []
        if (returns.length > 0 && posicao_fila) {
          const returnIdx = Math.min(posicao_fila - 1, returns.length - 1)
          const targetReturnDate = new Date(returns[returnIdx])
          if (targetReturnDate < now) {
            const adjusted = new Date(now)
            adjusted.setDate(adjusted.getDate() + 1)
            data_estimada_disponibilidade = adjusted.toISOString()
          } else {
            data_estimada_disponibilidade = targetReturnDate.toISOString()
          }
        } else if (posicao_fila === 1) {
          const fallback = new Date(now)
          fallback.setDate(fallback.getDate() + 7)
          data_estimada_disponibilidade = fallback.toISOString()
        }

        if (res.status_reserva === 'Pronta para Retirada' && res.data_limite_retirada) {
          const limit = new Date(res.data_limite_retirada)
          const diffMs = limit.getTime() - now.getTime()
          horas_restantes_garantida = Math.max(0, Math.round(diffMs / (1000 * 60 * 60)))
        }
      }

      const historico_evento = historicoMap[res.id_reserva] || null

      return {
        ...res,
        posicao_fila,
        total_fila,
        data_estimada_disponibilidade,
        horas_restantes_garantida,
        historico_evento,
      }
    })
  },

  /**
   * Conta reservas ativas pendentes para badge no cabeçalho
   */
  async countActive(): Promise<number> {
    const { count, error } = await supabase
      .from('reserva')
      .select('*', { count: 'exact', head: true })
      .in('status_reserva', ['Ativa', 'Pronta para Retirada'])

    if (error) return 0
    return count ?? 0
  },

  /**
   * Pular Fila / Mover para o topo da fila (Admin)
   */
  async promoteToTopOfQueue(id_reserva: number, operatorName = 'Administrador') {
    const { data: res, error: resErr } = await supabase
      .from('reserva')
      .select('*, titulo(titulo_de_livro), leitor(nome_do_leitor)')
      .eq('id_reserva', id_reserva)
      .single()

    if (resErr || !res) throw new Error('Reserva não encontrada.')

    const { data: queue } = await (supabase.from('reserva') as any)
      .select('id_reserva, ordem_fila, data_reserva')
      .eq('id_titulo', res.id_titulo)
      .in('status_reserva', ['Ativa', 'Pronta para Retirada'])
      .order('ordem_fila', { ascending: true })
      .order('data_reserva', { ascending: true })

    if (!queue || queue.length <= 1) return

    let currentRank = 1
    await (supabase.from('reserva') as any)
      .update({ ordem_fila: currentRank })
      .eq('id_reserva', id_reserva)

    for (const item of queue as any[]) {
      if (item.id_reserva !== id_reserva) {
        currentRank++
        await (supabase.from('reserva') as any)
          .update({ ordem_fila: currentRank })
          .eq('id_reserva', item.id_reserva)
      }
    }

    try {
      const bookTitle = (res.titulo as any)?.titulo_de_livro || res.id_titulo
      const readerName = (res.leitor as any)?.nome_do_leitor || `Leitor #${res.id_leitor}`
      await HistoricoService.log(
        res.id_titulo,
        'Fila Reordenada',
        res.id_leitor,
        `Prioridade alterada (Pular Fila): Reserva #${id_reserva} do leitor ${readerName} ("${bookTitle}") promovida para a 1ª posição da fila pelo administrador ${operatorName}.`,
        operatorName,
        'titulo',
      )
    } catch (logErr) {
      console.warn('Erro ao registrar log de reordenação:', logErr)
    }
  },

  /**
   * Reordenar posição de uma reserva na fila (mover para cima ou para baixo)
   */
  async reorderQueue(
    id_titulo: string,
    orderedReservaIds: number[],
    operatorName = 'Administrador',
  ) {
    for (let i = 0; i < orderedReservaIds.length; i++) {
      const resId = orderedReservaIds[i]
      await (supabase.from('reserva') as any).update({ ordem_fila: i + 1 }).eq('id_reserva', resId)
    }

    try {
      await HistoricoService.log(
        id_titulo,
        'Fila Reordenada',
        undefined,
        `Fila de espera da obra ${id_titulo} reordenada manualmente pelo operador ${operatorName}.`,
        operatorName,
        'titulo',
      )
    } catch (logErr) {
      console.warn('Erro ao registrar log:', logErr)
    }
  },

  /**
   * Marcar livro como "Pronto para Retirada" com tempo de Reserva Garantida (ex: 24h)
   * e disparar notificação por e-mail/push/toast
   */
  async markReadyForPickup(
    id_reserva: number,
    id_exemplar?: string,
    customHours?: number,
    operatorName = 'Sistema',
  ) {
    const { data: res, error: resErr } = await supabase
      .from('reserva')
      .select('*, titulo(titulo_de_livro), leitor(nome_do_leitor, email, telefone)')
      .eq('id_reserva', id_reserva)
      .single()

    if (resErr || !res) throw new Error('Reserva não encontrada.')

    const hours = customHours || (await getTempoReservaGarantidaHoras())
    const limitDate = new Date()
    limitDate.setHours(limitDate.getHours() + hours)

    if (id_exemplar) {
      await supabase.from('exemplar').update({ status: 'Reservado' }).eq('id_exemplar', id_exemplar)
    }

    const { data, error } = await (supabase.from('reserva') as any)
      .update({
        status_reserva: 'Pronta para Retirada',
        data_limite_retirada: limitDate.toISOString(),
        exemplar_reservado_id: id_exemplar || null,
        notificacao_enviada: true,
        data_notificacao: new Date().toISOString(),
      })
      .eq('id_reserva', id_reserva)
      .select()
      .single()

    if (error) throw error

    const bookTitle = (res.titulo as any)?.titulo_de_livro || res.id_titulo
    const readerName = (res.leitor as any)?.nome_do_leitor || `Leitor #${res.id_leitor}`
    const readerEmail = (res.leitor as any)?.email || ''

    try {
      await HistoricoService.log(
        res.id_titulo,
        'Reserva Disponível',
        res.id_leitor,
        `Obra "${bookTitle}" liberada para retirada do leitor ${readerName} (${readerEmail}). Reserva garantida por ${hours}h até ${limitDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} do dia ${limitDate.toLocaleDateString('pt-BR')}. Notificação enviada.`,
        operatorName,
        'titulo',
      )
    } catch (logErr) {
      console.warn('Erro ao registrar log de reserva disponível:', logErr)
    }

    return {
      data,
      limitDate,
      hours,
      readerName,
      readerEmail,
      bookTitle,
    }
  },

  async create(id_titulo: string, id_leitor: number, operatorName?: string) {
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

    const { count: userActiveReservas } = await supabase
      .from('reserva')
      .select('*', { count: 'exact', head: true })
      .eq('id_leitor', id_leitor)
      .in('status_reserva', ['Ativa', 'Pronta para Retirada'])

    if ((userActiveReservas || 0) >= 3) {
      throw new Error('Limite máximo de 3 reservas ativas simultâneas atingido para este leitor.')
    }

    const { data: existing } = await supabase
      .from('reserva')
      .select('id_reserva')
      .eq('id_titulo', id_titulo)
      .eq('id_leitor', id_leitor)
      .in('status_reserva', ['Ativa', 'Pronta para Retirada'])
      .maybeSingle()

    if (existing) {
      throw new Error('Você já possui uma reserva ativa na fila para esta obra.')
    }

    const { data: emprestimosAtivosDoLeitor } = await supabase
      .from('emprestimo')
      .select('id_emprestimo, exemplar!inner(id_titulo)')
      .eq('id_leitor', id_leitor)
      .is('data_devolucao_real', null)
      .eq('exemplar.id_titulo', id_titulo)

    if (emprestimosAtivosDoLeitor && emprestimosAtivosDoLeitor.length > 0) {
      throw new Error('Você já possui um exemplar desta mesma obra emprestado atualmente.')
    }

    const { data: reader } = await supabase
      .from('leitor')
      .select('bloqueado, nome_do_leitor')
      .eq('id_leitor', id_leitor)
      .single()

    if (reader?.bloqueado) {
      throw new Error('Leitor com cadastro bloqueado não pode solicitar reservas.')
    }

    const { data: tituloData } = await supabase
      .from('titulo')
      .select('titulo_de_livro')
      .eq('id_titulo', id_titulo)
      .single()

    const tituloNome = tituloData?.titulo_de_livro || id_titulo
    const leitorNome = reader?.nome_do_leitor || `Leitor #${id_leitor}`

    const { data: currentQueue } = await (supabase.from('reserva') as any)
      .select('ordem_fila')
      .eq('id_titulo', id_titulo)
      .in('status_reserva', ['Ativa', 'Pronta para Retirada'])
      .order('ordem_fila', { ascending: false })
      .limit(1)

    const nextOrder =
      (currentQueue && currentQueue.length > 0 ? (currentQueue[0] as any).ordem_fila || 0 : 0) + 1

    const { data, error } = await (supabase.from('reserva') as any)
      .insert({
        id_titulo,
        id_leitor,
        status_reserva: 'Ativa',
        ordem_fila: nextOrder,
        data_reserva: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error

    try {
      await HistoricoService.log(
        id_titulo,
        'Reserva Criada',
        id_leitor,
        `Reserva da obra "${tituloNome}" solicitada para o leitor ${leitorNome} (posição ${nextOrder} na fila)`,
        operatorName || 'Sistema',
        'titulo',
      )
    } catch (logErr) {
      console.warn('Erro ao registrar log de reserva criada:', logErr)
    }

    return data
  },

  async cancel(id_reserva: number, operatorName?: string) {
    const { data: reserva } = await (supabase.from('reserva') as any)
      .select(`
        id_reserva,
        id_titulo,
        id_leitor,
        exemplar_reservado_id,
        titulo:id_titulo(titulo_de_livro),
        leitor:id_leitor(nome_do_leitor)
      `)
      .eq('id_reserva', id_reserva)
      .single()

    if (reserva && (reserva as any).exemplar_reservado_id) {
      await supabase
        .from('exemplar')
        .update({ status: 'Disponivel' })
        .eq('id_exemplar', (reserva as any).exemplar_reservado_id)
    }

    const { data, error } = await supabase
      .from('reserva')
      .update({ status_reserva: 'Cancelada' })
      .eq('id_reserva', id_reserva)
      .select()
      .single()

    if (error) throw error

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
    const { data: reservaData, error: resErr } = await (supabase.from('reserva') as any)
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

    let copyToUseId = (reservaData as any).exemplar_reservado_id

    if (!copyToUseId) {
      const { data: exemplares, error: exErr } = await supabase
        .from('exemplar')
        .select('id_exemplar, status')
        .eq('id_titulo', reservaData.id_titulo)
        .in('status', ['Disponivel', 'Reservado'])
        .limit(1)

      if (exErr) throw exErr
      if (exemplares && exemplares.length > 0) {
        copyToUseId = exemplares[0].id_exemplar
      }
    }

    if (!copyToUseId) {
      throw new Error('Nenhum exemplar disponível para atender esta reserva no momento.')
    }

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

    const now = new Date()
    const expected = new Date()
    expected.setDate(now.getDate() + 15)

    const { error: loanErr } = await supabase.from('emprestimo').insert({
      id_exemplar: copyToUseId,
      id_leitor: reservaData.id_leitor,
      data_emprestimo: now.toISOString(),
      data_prevista_devolucao: expected.toISOString(),
      atraso: false,
    })

    if (loanErr) throw loanErr

    await supabase.from('exemplar').update({ status: 'Emprestado' }).eq('id_exemplar', copyToUseId)

    try {
      const bookTitle = (reservaData.titulo as any)?.titulo_de_livro || reservaData.id_titulo
      const readerName =
        (reservaData.leitor as any)?.nome_do_leitor || `Leitor #${reservaData.id_leitor}`

      await HistoricoService.log(
        copyToUseId,
        'Reserva Atendida',
        reservaData.id_leitor,
        `Reserva #${id_reserva} atendida: exemplar ${copyToUseId} ("${bookTitle}") emprestado para o leitor ${readerName}`,
        operatorName,
        'exemplar',
      )
    } catch (logError) {
      console.warn('Erro ao registrar log da reserva atendida:', logError)
    }

    return data
  },
}
