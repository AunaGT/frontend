import * as React from 'react'
import type { LucideIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface IconInputProps extends React.ComponentProps<typeof Input> {
  label: string
  icon: LucideIcon
  error?: string
  endAdornment?: React.ReactNode
}

export const IconInput = React.forwardRef<HTMLInputElement, IconInputProps>(
  ({ label, icon: Icon, error, endAdornment, className, id, ...props }, ref) => {
    const generatedId = React.useId()
    const inputId = id ?? generatedId
    const errorId = error ? `${inputId}-error` : undefined

    return (
      <div className="space-y-2">
        <label htmlFor={inputId} className="text-sm font-medium text-brand-navy dark:text-foreground">
          {label}
        </label>
        <div className="relative">
          <Icon
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            ref={ref}
            id={inputId}
            aria-invalid={Boolean(error)}
            aria-describedby={errorId}
            className={cn(
              'h-12 rounded-xl bg-white pl-10 text-sm shadow-sm transition-shadow focus-visible:ring-brand-orange dark:bg-background',
              endAdornment && 'pr-11',
              error && 'border-destructive focus-visible:ring-destructive',
              className,
            )}
            {...props}
          />
          {endAdornment && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2">{endAdornment}</div>
          )}
        </div>
        {error && (
          <p id={errorId} role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    )
  },
)

IconInput.displayName = 'IconInput'
