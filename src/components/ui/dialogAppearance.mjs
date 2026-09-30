const commonContent = 'w-[calc(100vw-2rem)] max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto rounded-2xl border-border bg-white p-5 text-foreground [--primary:var(--brand-orange)] [--primary-foreground:0_0%_100%] [--ring:var(--brand-orange)] shadow-[0_28px_90px_rgba(2,8,23,.38)] dark:bg-brand-surface sm:p-6'
const dialogSlots = '[&_[data-slot=dialog-header]]:sticky [&_[data-slot=dialog-header]]:top-0 [&_[data-slot=dialog-header]]:z-10 [&_[data-slot=dialog-header]]:border-b [&_[data-slot=dialog-header]]:bg-inherit [&_[data-slot=dialog-header]]:pb-4 [&_[data-slot=dialog-header]]:pr-12 [&_[data-slot=dialog-title]]:text-xl [&_[data-slot=dialog-footer]]:sticky [&_[data-slot=dialog-footer]]:bottom-0 [&_[data-slot=dialog-footer]]:border-t [&_[data-slot=dialog-footer]]:bg-inherit [&_[data-slot=dialog-footer]]:pt-4 [&_[data-slot=dialog-footer]>button]:w-full sm:[&_[data-slot=dialog-footer]>button]:w-auto'
const alertSlots = '[&_[data-slot=alert-dialog-header]]:border-b [&_[data-slot=alert-dialog-header]]:pb-4 [&_[data-slot=alert-dialog-title]]:text-xl [&_[data-slot=alert-dialog-footer]]:border-t [&_[data-slot=alert-dialog-footer]]:pt-4 [&_[data-slot=alert-dialog-footer]>button]:w-full sm:[&_[data-slot=alert-dialog-footer]>button]:w-auto'

export const getDialogAppearance = (variant = 'default', kind = 'dialog') => {
  if (variant !== 'auna') return { overlay: undefined, content: undefined, close: undefined }

  return {
    overlay: 'bg-slate-950/70 backdrop-blur-[2px]',
    content: `${commonContent} ${kind === 'alert' ? alertSlots : dialogSlots}`,
    close: kind === 'dialog' ? 'grid size-10 place-items-center rounded-xl hover:bg-muted focus:ring-brand-orange' : undefined,
  }
}
