import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { Loader2 } from 'lucide-react'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireAdmin?: boolean
  requireOperator?: boolean
}

export default function ProtectedRoute({
  children,
  requireAdmin = false,
  requireOperator = false,
}: ProtectedRouteProps) {
  const { user, loading, isAdmin, isOperadorOrAdmin } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        <p className="text-xs font-medium">Verificando autenticação...</p>
      </div>
    )
  }

  if (!user) {
    // Redireciona para o login guardando a localização atual
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />
  }

  if (requireOperator && !isOperadorOrAdmin) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
