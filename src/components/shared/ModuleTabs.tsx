import type { ComponentType, SVGProps } from 'react'
import * as React from 'react'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

const listClasses = 'inline-flex h-12 min-w-max items-center rounded-xl border border-border/70 bg-card p-1 shadow-sm dark:bg-[#101f34]'
const triggerClasses = 'h-10 shrink-0 gap-2 rounded-lg px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 data-[state=active]:bg-brand-orange data-[state=active]:text-white data-[state=active]:shadow-sm sm:px-4 sm:text-sm'

export const ModuleTabsList = React.forwardRef<
  React.ElementRef<typeof TabsList>,
  React.ComponentPropsWithoutRef<typeof TabsList>
>(({ className, ...props }, ref) => (
  <TabsList ref={ref} className={cn(listClasses, className)} {...props} />
))
ModuleTabsList.displayName = 'ModuleTabsList'

export const ModuleTabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsTrigger>,
  React.ComponentPropsWithoutRef<typeof TabsTrigger>
>(({ className, ...props }, ref) => (
  <TabsTrigger ref={ref} className={cn(triggerClasses, className)} {...props} />
))
ModuleTabsTrigger.displayName = 'ModuleTabsTrigger'

type TabIcon = ComponentType<SVGProps<SVGSVGElement>>

export type ModuleTabItem<T extends string> = {
  value: T
  label: string
  icon?: TabIcon
}

type ModuleTabBarProps<T extends string> = {
  items: readonly ModuleTabItem<NoInfer<T>>[]
  value: T
  onValueChange: (value: NoInfer<T>) => void
  ariaLabel: string
  className?: string
}

export function ModuleTabBar<T extends string>({ items, value, onValueChange, ariaLabel, className }: ModuleTabBarProps<T>) {
  return <div className={cn('max-w-full overflow-x-auto pb-1', className)}>
    <div role="tablist" aria-label={ariaLabel} className={listClasses}>
      {items.map((item) => {
        const Icon = item.icon
        const active = item.value === value
        return <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={active}
          className={cn(triggerClasses, active && 'bg-brand-orange text-white shadow-sm')}
          onClick={() => onValueChange(item.value)}
        >
          {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
          {item.label}
        </button>
      })}
    </div>
  </div>
}
