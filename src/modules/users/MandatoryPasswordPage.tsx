import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LockKeyhole } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/context/useAuth'
import { useToast } from '@/hooks/use-toast'
import { changeMyPassword } from '@/services/userService'

export default function MandatoryPasswordPage() {
  const { logout } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (newPassword.length < 10 || newPassword !== confirmPassword) {
      toast({ title: newPassword.length < 10 ? 'Usa al menos 10 caracteres' : 'Las contraseñas no coinciden', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      await changeMyPassword({ current_password: currentPassword, new_password: newPassword })
      logout()
      navigate('/login', { replace: true })
      toast({ title: 'Contraseña actualizada. Ingresa de nuevo.' })
    } catch (error) {
      toast({ title: 'No se pudo cambiar la contraseña', description: (error as Error).message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return <main className="min-h-dvh flex items-center justify-center bg-brand-surface p-4 dark:bg-brand-navy">
    <form onSubmit={submit} className="w-full max-w-md space-y-5 rounded-2xl border border-border bg-card p-7 shadow-xl">
      <div className="flex items-center gap-3 text-brand-orange"><LockKeyhole aria-hidden="true" /><span className="text-xs font-bold uppercase tracking-[.18em]">Seguridad de la cuenta</span></div>
      <div><h1 className="text-2xl font-bold">Cambia tu contraseña</h1><p className="mt-2 text-sm text-muted-foreground">Tu contraseña actual es temporal. Cámbiala para continuar usando el ERP.</p></div>
      <label className="block space-y-2 text-sm">Contraseña temporal<Input type="password" autoComplete="current-password" required value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} /></label>
      <label className="block space-y-2 text-sm">Nueva contraseña<Input type="password" autoComplete="new-password" required minLength={10} value={newPassword} onChange={event => setNewPassword(event.target.value)} /></label>
      <label className="block space-y-2 text-sm">Confirmar nueva contraseña<Input type="password" autoComplete="new-password" required minLength={10} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} /></label>
      <Button type="submit" disabled={saving} className="w-full bg-brand-orange text-white hover:bg-brand-orange-strong">{saving ? 'Guardando…' : 'Cambiar contraseña'}</Button>
      <Button type="button" variant="ghost" className="w-full" onClick={() => { logout(); navigate('/login', { replace: true }) }}>Cerrar sesión</Button>
    </form>
  </main>
}
