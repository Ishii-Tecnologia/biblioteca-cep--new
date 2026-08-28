import React from 'react'
import { NavLink, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { getPrazoEmprestimoDias } from '@/services/parametros'
import {
  BookOpen,
  Users,
  Repeat,
  BookmarkCheck,
  History,
  Settings,
  LayoutDashboard,
  LogOut,
  LogIn,
  Library,
  Shield,
  Menu,
  X,
  BookMarked,
  KeyRound,
} from 'lucide-react'
import { ChangeOwnPasswordModal } from '@/components/ChangeOwnPasswordModal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface LayoutProps {
  children?: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { user, profile, isAdmin, isOperadorOrAdmin, signOut } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)
  const [prazoDias, setPrazoDias] = React.useState<number>(15)
  const [changePasswordOpen, setChangePasswordOpen] = React.useState(false)
  const navigate = useNavigate()

  React.useEffect(() => {
    getPrazoEmprestimoDias()
      .then(setPrazoDias)
      .catch(() => {})
  }, [])

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const navItems = [
    { to: '/', label: 'Início', icon: LayoutDashboard, authRequired: false },
    { to: '/acervo', label: 'Livros', icon: BookOpen, authRequired: false },
    { to: '/emprestimos', label: 'Empréstimos', icon: Repeat, authRequired: true },
    { to: '/reservas', label: 'Reservas', icon: BookmarkCheck, authRequired: true },
    { to: '/leitores', label: 'Leitores', icon: Users, authRequired: true, operatorOnly: true },
    {
      to: '/historico',
      label: 'Relatórios',
      icon: History,
      authRequired: true,
      operatorOnly: true,
    },
    { to: '/usuarios', label: 'Usuários', icon: Shield, authRequired: true, adminOnly: true },
    {
      to: '/configuracoes',
      label: 'Configurações',
      icon: Settings,
      authRequired: true,
      adminOnly: true,
    },
  ]

  const getInitials = (name?: string) => {
    if (!name) return 'U'
    const parts = name.trim().split(' ')
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    return name.substring(0, 2).toUpperCase()
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Main Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Brand */}
            <div className="flex items-center gap-3">
              <Link to="/" className="flex items-center gap-2.5 group">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                  <Library className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-slate-900 leading-tight tracking-tight flex items-center gap-1.5 text-lg">
                    Biblioteca CEP
                    <Badge
                      variant="secondary"
                      className="text-[10px] font-medium bg-emerald-50 text-emerald-700 border-emerald-200"
                    >
                      v2.0
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-none">
                    Sistema de Gestão de Acervo & Empréstimos
                  </p>
                </div>
              </Link>
            </div>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                if (item.authRequired && !user) return null
                if (item.adminOnly && !isAdmin) return null
                if (item.operatorOnly && !isOperadorOrAdmin) return null
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-800 font-semibold'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </NavLink>
                )
              })}
            </nav>

            {/* Right actions: User menu or login */}
            <div className="flex items-center gap-3">
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="flex items-center gap-2 p-1.5 h-auto rounded-full hover:bg-slate-100"
                    >
                      <Avatar className="w-8 h-8 border border-slate-200">
                        {profile?.avatar_url ? (
                          <AvatarImage
                            src={profile.avatar_url}
                            alt={profile.full_name || 'Foto de perfil'}
                            className="object-cover"
                          />
                        ) : null}
                        <AvatarFallback className="bg-emerald-100 text-emerald-800 text-xs font-bold">
                          {getInitials(profile?.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="hidden sm:block text-left pr-1">
                        <p className="text-xs font-semibold text-slate-800 leading-tight max-w-[120px] truncate">
                          {profile?.full_name || 'Usuário'}
                        </p>
                        <span className="inline-block text-[10px] text-emerald-700 font-medium">
                          {isAdmin ? 'Administrador' : isOperadorOrAdmin ? 'Operador' : 'Leitor'}
                        </span>
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="font-medium text-slate-900">
                        {profile?.full_name || 'Minha Conta'}
                      </div>
                      <div className="text-xs text-slate-500 font-normal truncate">
                        {user.email}
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded w-fit">
                        <Shield className="w-3 h-3" />
                        Perfil:{' '}
                        <span className="font-semibold">
                          {isAdmin ? 'Administrador' : 'Leitor'}
                        </span>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/acervo" className="cursor-pointer">
                        <BookMarked className="w-4 h-4 mr-2" />
                        Explorar Acervo
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/emprestimos" className="cursor-pointer">
                        <Repeat className="w-4 h-4 mr-2" />
                        Empréstimos
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/reservas" className="cursor-pointer">
                        <BookmarkCheck className="w-4 h-4 mr-2" />
                        Reservas
                      </Link>
                    </DropdownMenuItem>
                    {isOperadorOrAdmin && (
                      <>
                        <DropdownMenuItem asChild>
                          <Link to="/leitores" className="cursor-pointer">
                            <Users className="w-4 h-4 mr-2" />
                            Leitores
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to="/historico" className="cursor-pointer">
                            <History className="w-4 h-4 mr-2" />
                            Relatórios
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}
                    {isAdmin && (
                      <>
                        <DropdownMenuItem asChild>
                          <Link to="/usuarios" className="cursor-pointer">
                            <Shield className="w-4 h-4 mr-2" />
                            Usuários
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to="/configuracoes" className="cursor-pointer">
                            <Settings className="w-4 h-4 mr-2" />
                            Configurações
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setChangePasswordOpen(true)}
                      className="cursor-pointer text-slate-700 hover:text-slate-900"
                    >
                      <KeyRound className="w-4 h-4 mr-2 text-emerald-600" />
                      Alterar minha senha
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleSignOut}
                      className="text-rose-600 cursor-pointer focus:text-rose-600"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Sair da conta
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    asChild
                    size="sm"
                    variant="default"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-sm"
                  >
                    <Link to="/login">
                      <LogIn className="w-4 h-4" />
                      <span>Entrar</span>
                    </Link>
                  </Button>
                </div>
              )}

              {/* Mobile hamburger */}
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden text-slate-600"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Abrir menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Panel */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-2 pb-4 space-y-1">
            {navItems.map((item) => {
              if (item.authRequired && !user) return null
              if (item.adminOnly && !isAdmin) return null
              if (item.operatorOnly && !isOperadorOrAdmin) return null
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium ${
                      isActive
                        ? 'bg-emerald-50 text-emerald-800 font-semibold'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </NavLink>
              )
            })}
          </div>
        )}
      </header>

      {/* Main Content View */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">{children}</main>

      {/* Modal de Alteração da Própria Senha */}
      <ChangeOwnPasswordModal open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Library className="w-4 h-4 text-emerald-600" />
            <span className="font-semibold text-slate-700">Biblioteca CEP</span>
            <span>— Sistema Gratuito de Controle de Acervo e Empréstimos</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Sem taxas ou multas</span>
            <span>•</span>
            <span>Prazo: {prazoDias} dias</span>
            <span>•</span>
            <span>Versão 2.0</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
