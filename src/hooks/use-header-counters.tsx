import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { EmprestimosService } from '@/services/emprestimos'
import { ReservasService } from '@/services/reservas'

interface HeaderCountersContextType {
  emprestimosAtivos: number
  reservasAtivas: number
  loading: boolean
  refreshCounters: () => Promise<void>
}

const HeaderCountersContext = createContext<HeaderCountersContextType>({
  emprestimosAtivos: 0,
  reservasAtivas: 0,
  loading: false,
  refreshCounters: async () => {},
})

export function HeaderCountersProvider({ children }: { children: React.ReactNode }) {
  const [emprestimosAtivos, setEmprestimosAtivos] = useState(0)
  const [reservasAtivas, setReservasAtivas] = useState(0)
  const [loading, setLoading] = useState(false)

  const refreshCounters = useCallback(async () => {
    try {
      const [loansCount, reservesCount] = await Promise.all([
        EmprestimosService.countActive(),
        ReservasService.countActive(),
      ])
      setEmprestimosAtivos(loansCount)
      setReservasAtivas(reservesCount)
    } catch (err) {
      console.warn('Erro ao atualizar contadores do cabeçalho:', err)
    }
  }, [])

  useEffect(() => {
    refreshCounters()
    // Atualização periódica leve a cada 30 segundos
    const interval = setInterval(refreshCounters, 30000)
    return () => clearInterval(interval)
  }, [refreshCounters])

  return (
    <HeaderCountersContext.Provider
      value={{
        emprestimosAtivos,
        reservasAtivas,
        loading,
        refreshCounters,
      }}
    >
      {children}
    </HeaderCountersContext.Provider>
  )
}

export function useHeaderCounters() {
  return useContext(HeaderCountersContext)
}
