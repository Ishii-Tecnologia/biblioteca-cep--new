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
import { UserCog, Loader2, Upload, Camera, X, ClipboardPaste } from 'lucide-react'
import { uploadImageToStorage } from '@/lib/image-upload'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ProfileRecord } from '@/pages/Usuarios'
import { formatPhone } from '@/lib/utils'

interface EditUserModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: ProfileRecord | null
  isCurrentUser: boolean
  onSuccess: () => void
}

export function EditUserModal({
  open,
  onOpenChange,
  user,
  isCurrentUser,
  onSuccess,
}: EditUserModalProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    papel: 'leitor' as 'admin' | 'operador' | 'leitor',
    avatar_url: '',
  })

  useEffect(() => {
    if (open && user) {
      const currentRole = (user.papel || user.role || 'leitor') as 'admin' | 'operador' | 'leitor'
      const currentName = user.nome || user.full_name || ''
      const currentEmail = user.email || ''
      const currentAvatar = user.avatar_url || ''
      const currentTelefone = formatPhone(user.telefone || '')

      setFormData({
        nome: currentName,
        email: currentEmail,
        telefone: currentTelefone,
        papel: currentRole,
        avatar_url: currentAvatar,
      })
      setPhotoFile(null)
      setPhotoPreview(currentAvatar || null)
    }
  }, [open, user])

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
    setFormData((prev) => ({ ...prev, avatar_url: '' }))
  }

  const getInitials = (name?: string | null, email?: string) => {
    const raw = name || email || 'U'
    const parts = raw.trim().split(' ')
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    return raw.substring(0, 2).toUpperCase()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    const nome = formData.nome.trim()
    const email = formData.email.trim()

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

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      toast({
        title: 'E-mail inválido',
        description: 'Por favor, insira um formato de e-mail válido.',
        variant: 'destructive',
      })
      return
    }

    if (isCurrentUser && formData.papel !== 'admin') {
      toast({
        title: 'Ação não permitida',
        description: 'Você não pode rebaixar o seu próprio papel de administrador.',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      let finalAvatarUrl: string | null = formData.avatar_url || null

      // Se houver novo arquivo de foto, comprimir e fazer upload
      if (photoFile) {
        finalAvatarUrl = await uploadImageToStorage(photoFile, 'avatars', {
          maxWidth: 400,
          maxHeight: 400,
          quality: 0.8,
          outputFormat: 'image/jpeg',
        })
      } else if (!photoPreview) {
        finalAvatarUrl = null
      }

      // Executar RPC que atualiza profiles e auth.users
      const { data: rpcData, error: rpcError } = await (supabase.rpc as any)('update_user_info', {
        target_user_id: user.id,
        new_name: nome,
        new_email: email,
        new_role: formData.papel,
        new_avatar_url: finalAvatarUrl,
        new_telefone: formData.telefone.trim() || null,
      })

      if (rpcError) throw rpcError

      toast({
        title: 'Usuário atualizado com sucesso!',
        description: `As informações de ${nome} foram salvas.`,
      })

      onSuccess()
      onOpenChange(false)
    } catch (err: any) {
      toast({
        title: 'Erro ao atualizar usuário',
        description: err.message || 'Não foi possível salvar as alterações do usuário.',
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
              <UserCog className="w-5 h-5 text-emerald-600" />
              Editar Informações do Usuário
            </DialogTitle>
            <DialogDescription>
              Altere os dados cadastrais, papel de acesso e foto de perfil do usuário.
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
                    {getInitials(formData.nome, formData.email) || (
                      <Camera className="w-6 h-6 text-emerald-600" />
                    )}
                  </AvatarFallback>
                )}
              </Avatar>

              <div className="space-y-1.5 flex-1 text-center sm:text-left">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-slate-800">
                    Foto de Perfil / Avatar
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
                    <span>{photoPreview ? 'Alterar Foto' : 'Selecionar Foto'}</span>
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

            {/* Nome Completo */}
            <div>
              <Label htmlFor="edit-user-name" className="text-xs font-semibold text-slate-700">
                Nome Completo *
              </Label>
              <Input
                id="edit-user-name"
                required
                placeholder="Ex: João Silva"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className="mt-1"
                disabled={loading}
              />
            </div>

            {/* Email (Desabilitado / Somente Leitura) */}
            <div>
              <Label htmlFor="edit-user-email" className="text-xs font-semibold text-slate-700">
                Endereço de E-mail (Somente leitura)
              </Label>
              <Input
                id="edit-user-email"
                type="email"
                required
                readOnly
                disabled
                placeholder="Ex: joao.silva@exemplo.com"
                value={formData.email}
                className="mt-1 bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                O endereço de e-mail não pode ser alterado diretamente por questões de segurança de
                autenticação.
              </p>
            </div>

            {/* Telefone */}
            <div>
              <Label htmlFor="edit-user-phone" className="text-xs font-semibold text-slate-700">
                Telefone / WhatsApp
              </Label>
              <Input
                id="edit-user-phone"
                type="tel"
                placeholder="(XX) XXXXX-XXXX"
                maxLength={15}
                value={formData.telefone}
                onChange={(e) =>
                  setFormData({ ...formData, telefone: formatPhone(e.target.value) })
                }
                className="mt-1"
                disabled={loading}
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Número de contato para avisos de empréstimos, devoluções e reservas.
              </p>
            </div>

            {/* Papel / Permissão */}
            <div>
              <Label htmlFor="edit-user-role" className="text-xs font-semibold text-slate-700">
                Papel / Permissão *
              </Label>
              <Select
                value={formData.papel}
                onValueChange={(val: 'admin' | 'operador' | 'leitor') =>
                  setFormData({ ...formData, papel: val })
                }
                disabled={loading}
              >
                <SelectTrigger id="edit-user-role" className="mt-1">
                  <SelectValue placeholder="Selecione o papel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="leitor" disabled={isCurrentUser && formData.papel === 'admin'}>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-600" />
                      <span>Leitor (Padrão - consulta e reservas)</span>
                    </div>
                  </SelectItem>
                  <SelectItem
                    value="operador"
                    disabled={isCurrentUser && formData.papel === 'admin'}
                  >
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
              {isCurrentUser && formData.papel === 'admin' && (
                <p className="text-[11px] text-slate-500 mt-1">
                  Você não pode alterar seu próprio papel de administrador.
                </p>
              )}
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
              Salvar Alterações
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
