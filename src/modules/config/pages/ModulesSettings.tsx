import { useState } from 'react'
import { AlertCircle, Boxes, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { useModules } from '@/context/useModules'
import { useToast } from '@/hooks/use-toast'
import { updateCompanyModule } from '@/services/moduleService'

const STATUS_LABELS = {
  ACTIVE: 'Activo',
  TRIAL: 'Prueba',
  SUSPENDED: 'Suspendido',
  DISABLED: 'Desactivado',
} as const

export const ModulesSettings = ({ canManage }: { canManage: boolean }) => {
  const { modules, isLoading, isError, refetch } = useModules()
  const { toast } = useToast()
  const [savingCode, setSavingCode] = useState<string | null>(null)

  const toggle = async (code: string, enabled: boolean) => {
    setSavingCode(code)
    try {
      await updateCompanyModule(code, { status: enabled ? 'ACTIVE' : 'DISABLED' })
      await refetch()
      toast({ title: enabled ? 'Módulo activado' : 'Módulo desactivado' })
    } catch (error) {
      toast({
        title: 'No se pudo cambiar el módulo',
        description: error instanceof Error ? error.message : 'Intente nuevamente',
        variant: 'destructive',
      })
    } finally {
      setSavingCode(null)
    }
  }

  if (isLoading) {
    return <div className="flex min-h-[180px] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-6 text-sm text-destructive">
          <AlertCircle className="h-5 w-5" /> No se pudo cargar el catálogo de módulos.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Boxes className="h-5 w-5" /> Módulos de la empresa</CardTitle>
        <CardDescription>
          La activación define qué contrató la empresa. Los permisos de cada usuario se administran por separado.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2">
          {modules.map((module) => {
            const ownEnabled = module.status === 'ACTIVE' || module.status === 'TRIAL'
            const saving = savingCode === module.code
            return (
              <div key={module.code} className="flex items-start justify-between gap-4 rounded-xl border p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{module.name}</span>
                    <Badge variant={module.effectiveEnabled ? 'secondary' : 'outline'}>
                      {module.blockedBy.length > 0 ? 'Bloqueado' : STATUS_LABELS[module.status]}
                    </Badge>
                    {module.protected ? <Badge variant="outline">Base</Badge> : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {module.blockedBy.length > 0
                      ? `Requiere activar: ${module.blockedBy.join(', ')}`
                      : module.dependencies.length > 0
                        ? `Depende de: ${module.dependencies.join(', ')}`
                        : 'Sin dependencias de negocio'}
                  </p>
                </div>
                <div className="flex h-6 items-center">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                    <Switch
                      checked={ownEnabled}
                      disabled={!canManage || module.protected || savingCode !== null}
                      onCheckedChange={(checked) => toggle(module.code, checked)}
                      aria-label={`${ownEnabled ? 'Desactivar' : 'Activar'} ${module.name}`}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

export default ModulesSettings
