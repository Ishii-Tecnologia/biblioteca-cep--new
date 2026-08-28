import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'

export type UserRole = 'admin' | 'operador' | 'leitor' | 'guest'

export interface UserProfile {
  id: string
  email: string
  full_name: string
  role: UserRole
  avatar_url?: string
  id_leitor?: number
}

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  role: UserRole
  isAdmin: boolean
  isOperadorOrAdmin: boolean
  signUp: (
    email: string,
    password: string,
    fullName?: string,
    role?: UserRole,
  ) => Promise<{ error: any }>
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signOut: () => Promise<{ error: any }>
  quickLoginAs: (role: 'admin' | 'leitor') => Promise<{ error: any }>
  loading: boolean
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (currentUser: User | null) => {
    if (!currentUser) {
      setProfile(null)
      return
    }

    try {
      const userMeta = currentUser.user_metadata || {}
      let role: UserRole = (userMeta.app_role || userMeta.role || 'leitor') as UserRole
      if (currentUser.email === 'admin@cep.edu.br' || currentUser.email === 'ishii7883@gmail.com') {
        role = 'admin'
      }

      // Check if there is a leitor record linked
      const { data: leitorData } = await supabase
        .from('leitor')
        .select('id_leitor, nome_do_leitor')
        .or(`id_auth.eq.${currentUser.id},email.eq.${currentUser.email}`)
        .maybeSingle()

      // Fetch public.profiles to get real-time avatar_url and latest name/papel
      const { data: profileRow } = await supabase
        .from('profiles')
        .select('nome, full_name, role, papel, avatar_url')
        .eq('id', currentUser.id)
        .maybeSingle()

      const fullName =
        profileRow?.nome ||
        profileRow?.full_name ||
        leitorData?.nome_do_leitor ||
        userMeta.full_name ||
        currentUser.email?.split('@')[0] ||
        'Usuário'

      const avatarUrl = profileRow?.avatar_url || userMeta.avatar_url || undefined

      setProfile({
        id: currentUser.id,
        email: currentUser.email || '',
        full_name: fullName,
        role: (profileRow?.papel || profileRow?.role || role) as UserRole,
        avatar_url: avatarUrl,
        id_leitor: leitorData?.id_leitor,
      })
    } catch (e) {
      console.error('Error loading profile:', e)
      setProfile({
        id: currentUser.id,
        email: currentUser.email || '',
        full_name: currentUser.email?.split('@')[0] || 'Usuário',
        role: currentUser.email?.includes('admin') ? 'admin' : 'leitor',
      })
    }
  }

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // FORBIDDEN: no async/await inside this callback — sync only
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (user) {
      fetchProfile(user)
    } else {
      setProfile(null)
    }
  }, [user])

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user)
    }
  }

  const signUp = async (
    email: string,
    password: string,
    fullName?: string,
    role: UserRole = 'leitor',
  ) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          full_name: fullName || email.split('@')[0],
          role: role,
          app_role: role,
        },
      },
    })

    if (!error && data.user) {
      // Auto confirm email via RPC for immediate login
      try {
        await (supabase.rpc as any)('confirm_user_email', { user_id: data.user.id })
      } catch (rpcErr) {
        console.warn('Could not auto-confirm reader email via RPC:', rpcErr)
      }

      // Auto create reader entry
      try {
        await supabase.from('leitor').insert({
          id_auth: data.user.id,
          nome_do_leitor: fullName || email.split('@')[0],
          email: email,
          cpf: '',
          data_cadastro: new Date().toISOString().split('T')[0],
          bloqueado: false,
        })
      } catch (err) {
        console.warn('Could not auto-insert reader:', err)
      }
    }

    return { error }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  const quickLoginAs = async (targetRole: 'admin' | 'leitor') => {
    const email = targetRole === 'admin' ? 'admin@cep.edu.br' : 'leitor@cep.edu.br'
    const password = 'Skip@Pass'
    return await signIn(email, password)
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    setProfile(null)
    return { error }
  }

  const currentRole: UserRole = profile?.role || (user ? 'leitor' : 'guest')
  const isAdmin =
    currentRole === 'admin' ||
    user?.email === 'ishii7883@gmail.com' ||
    user?.email === 'admin@cep.edu.br'
  const isOperadorOrAdmin = isAdmin || currentRole === 'operador'

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role: currentRole,
        isAdmin,
        isOperadorOrAdmin,
        signUp,
        signIn,
        signOut,
        quickLoginAs,
        loading,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
