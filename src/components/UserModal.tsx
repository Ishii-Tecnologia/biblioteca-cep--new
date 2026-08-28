import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { supabase } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { UserPlus, Loader2, Eye, EyeOff, Upload, Camera, X, ClipboardPaste } from 'lucide-react'
import { uploadImageToStorage } from '@/lib/image-upload'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface UserModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function UserModal({ open, onOpenChange, onSuccess }: UserModalProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    password: '',
    papel: 'leitor' as 'admin' | 'operador' | 'leitor',
    avatar_url: '',
  })

  useEffect(() => {
    if (open) {
      setFormData({
        nome: '',
        email: '',
        password: '',
        papel: 'leitor',
        avatar_url: '',
      })
      setPhotoFile(null)
      setPhotoPreview(null)
      setShowPassword(false)
    }
  }, [open])

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPhotoFile(file)
      const reader = new FileReader()
      reader.onload = (ev) => {
        setPhotoPreview(ev.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.type.startsWith('image/')) {
        const blob = item.getAsFile()
        if (blob) {
          e.preventDefault()
          const pastedFile = new File([blob], `pasted-image-${Date.now()}.png`, {
            type: blob.type,
          })
          setPhotoFile(pastedFile)
          const reader = new FileReader()
          reader.onload = (ev) => {
            setPhotoPreview(ev.target?.result as string)
          }
          reader.readAsDataURL(pastedFile)
          toast({
            title: 'Imagem colada!',
            description: 'Foto de perfil colada com sucesso da área de transferência.',
          })
          break
        }
      }
    }
  }

  const handleRemovePhoto = () => {
    setPhotoFile(null)
    setPhotoPreview(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const nome = formData.nome.trim()
    const email = formData.email.trim()
    const password = formData.password

    if (!nome) {
      toast({
        title: 'Nome obrigatório',
        description: 'Por favor, informe o nome completo do usuário.',
        variant: 'destructive',
      })
      return
    }

    if (!email) {
      toast({
        title: 'E-mail obrigatório',
        description: 'Por favor, informe um endereço de e-mail válido.',
        variant: 'destructive',
      })
      return
    }

    // Basic email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      toast({
        title: 'E-mail inválido',
        description: 'Por favor, insira um formato de e-mail válido.',
        variant: 'destructive',
      })
      return
    }

    if (!password || password.length < 6) {
      toast({
        title: 'Senha muito curta',
        description: 'A senha provisória deve conter no mínimo 6 caracteres.',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      // Upload de avatar comprimido para o bucket 'avatars' (max 400px, 80% qualidade)
      let uploadedAvatarUrl = ''
      if (photoFile) {
        uploadedAvatarUrl = await uploadImageToStorage(photoFile, 'avatars', {
          maxWidth: 400,
          maxHeight: 400,
          quality: 0.8,
          outputFormat: 'image/jpeg',
        })
      }

      // 1. Chamar supabase.auth.signUp com metadata
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            nome,
            full_name: nome,
            papel: formData.papel,
            role: formData.papel,
            app_role: formData.papel,
            avatar_url: uploadedAvatarUrl || undefined,
          },
        },
      })

      if (authError) throw authError

      const userId = authData.user?.id

      if (userId) {
        // Confirmar email via RPC (garantia extra além do trigger BEFORE INSERT)
        try {
          await (supabase.rpc as any)('confirm_user_email', { user_id: userId })
        } catch (rpcErr) {
          console.warn('Aviso confirm_user_email RPC:', rpcErr)
        }

        // 2. Atualizar/Inserir na tabela profiles
        const { error: profileError } = await supabase.from('profiles').upsert(
          {
            id: userId,
            nome,
            full_name: nome,
            email,
            papel: formData.papel,
            role: formData.papel,
            avatar_url: uploadedAvatarUrl || null,
            bloqueado: false,
          },
          { onConflict: 'id' },
        )

        if (profileError) {
          console.warn('Erro ao atualizar perfil na tabela profiles:', profileError)
        }

        // Também assegurar cadastro de leitor se for leitor
        try {
          await supabase.from('leitor').upsert(
            {
              id_auth: userId,
              nome_do_leitor: nome,
              email: email,
              cpf: '',
              data_cadastro: new Date().toISOString().split('T')[0],
              bloqueado: false,
            },
            { onConflict: 'id_auth' },
          )
        } catch (leitorErr) {
          console.warn('Aviso leitor:', leitorErr)
        }
      }

      toast({
        title: 'Usuário cadastrado com sucesso!',
        description: `O usuário ${nome} (${email}) foi criado com o papel "${formData.papel}".`,
      })

      onSuccess()
      onOpenChange(false)
    } catch (err: any) {
      toast({
        title: 'Erro ao criar usuário',
        description: err.message || 'Não foi possível cadastrar o novo usuário no sistema.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <UserPlus className="w-5 h-5 text-emerald-600" />
              Novo Usuário
            </DialogTitle>
            <DialogDescription>
              Crie uma nova conta de acesso ao sistema e defina o nível de permissão.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Upload de Foto / Avatar */}
            <div
              onPaste={handlePaste}
              tabIndex={0}
              className="flex flex-col sm:flex-row items-center gap-4 p-3 bg-slate-50 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all cursor-default"
              title="Clique aqui e pressione Ctrl+V / Cmd+V para colar uma imagem da área de transferência"
            >
              <Avatar className="w-16 h-16 border-2 border-emerald-500 shadow-sm">
                {photoPreview ? (
                  <AvatarImage src={photoPreview} alt="Preview da foto" className="object-cover" />
                ) : (
                  <AvatarFallback className="bg-emerald-100 text-emerald-800 text-base font-bold">
                    <Camera className="w-6 h-6 text-emerald-600" />
                  </AvatarFallback>
                )}
              </Avatar>

              <div className="space-y-1.5 flex-1 text-center sm:text-left">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-slate-800">
                    Foto de Perfil (Opcional)
                  </Label>
                  <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-slate-400">
                    <ClipboardPaste className="w-3 h-3" /> Ctrl+V aceito
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Selecione um arquivo ou cole (Ctrl+V) diretamente aqui. Comprimida
                  automaticamente.
                </p>
                <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 shadow-xs">
                    <Upload className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Selecionar Foto</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/jpg"
                      onChange={handlePhotoSelect}
                      className="hidden"
                      disabled={loading}
                    />
                  </label>
                  {photoPreview && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemovePhoto}
                      className="h-7 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2"
                    >
                      <X className="w-3.5 h-3.5 mr-1" />
                      Remover
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Nome */}
            <div>
              <Label htmlFor="user-name" className="text-xs font-semibold text-slate-700">
                Nome Completo *
              </Label>
              <Input
                id="user-name"
                required
                placeholder="Ex: João Silva"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className="mt-1"
                disabled={loading}
              />
            </div>

            {/* Email */}
            <div>
              <Label htmlFor="user-email" className="text-xs font-semibold text-slate-700">
                Endereço de E-mail *
              </Label>
              <Input
                id="user-email"
                type="email"
                required
                placeholder="Ex: joao.silva@exemplo.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="mt-1"
                disabled={loading}
              />
            </div>

            {/* Senha */}
            <div>
              <Label htmlFor="user-password" className="text-xs font-semibold text-slate-700">
                Senha Inicial * (mínimo 6 caracteres)
              </Label>
              <div className="relative mt-1">
                <Input
                  id="user-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="******"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="pr-10"
                  disabled={loading}
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                  aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                O usuário poderá utilizar esta senha para acessar o painel.
              </p>
            </div>

            {/* Papel */}
            <div>
              <Label htmlFor="user-role" className="text-xs font-semibold text-slate-700">
                Papel / Permissão *
              </Label>
              <Select
                value={formData.papel}
                onValueChange={(val: 'admin' | 'operador' | 'leitor') =>
                  setFormData({ ...formData, papel: val })
                }
                disabled={loading}
              >
                <SelectTrigger id="user-role" className="mt-1">
                  <SelectValue placeholder="Selecione o papel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="leitor">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-600" />
                      <span>Leitor (Padrão - consulta e reservas)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="operador">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-600" />
                      <span>Operador (Bibliotecário - gestão de acervo e empréstimos)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-600" />
                      <span>Admin (Acesso total às configurações e usuários)</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              disabled={loading}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <UserPlus className="w-4 h-4" />
              Criar Usuário
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
