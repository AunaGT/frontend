const commonContent = 'w-[calc(100vw-2rem)] max-h-[calc(100dvh-2rem)] gap-4 overflow-y-auto rounded-2xl border-border bg-background p-5 text-foreground [--background:0_0%_100%] [--border:215_45%_88%] [--card:0_0%_100%] [--foreground:220_62%_18%] [--input:215_40%_82%] [--muted:216_40%_96%] [--muted-foreground:219_25%_45%] [--primary:var(--brand-orange)] [--primary-foreground:0_0%_100%] [--ring:var(--brand-orange)] shadow-[0_28px_90px_rgba(2,8,23,.38)] dark:[--background:215_46%_12%] dark:[--border:213_34%_25%] dark:[--card:215_46%_12%] dark:[--foreground:215_65%_96%] dark:[--input:213_34%_30%] dark:[--muted:215_38%_18%] dark:[--muted-foreground:215_30%_70%] sm:p-6'
const dialogSlots = '[&_[data-slot=dialog-header]]:sticky [&_[data-slot=dialog-header]]:top-0 [&_[data-slot=dialog-header]]:z-10 [&_[data-slot=dialog-header]]:border-b [&_[data-slot=dialog-header]]:bg-background [&_[data-slot=dialog-header]]:pb-4 [&_[data-slot=dialog-header]]:pr-12 [&_[data-slot=dialog-title]]:text-xl [&_[data-slot=dialog-footer]]:sticky [&_[data-slot=dialog-footer]]:bottom-0 [&_[data-slot=dialog-footer]]:border-t [&_[data-slot=dialog-footer]]:bg-background [&_[data-slot=dialog-footer]]:pt-4 [&_[data-slot=dialog-footer]]:gap-2 [&_[data-slot=dialog-footer]]:flex-col sm:[&_[data-slot=dialog-footer]]:flex-row [&_[data-slot=dialog-footer]>button]:w-full sm:[&_[data-slot=dialog-footer]>button]:w-auto'
const alertSlots = '[&_[data-slot=alert-dialog-header]]:border-b [&_[data-slot=alert-dialog-header]]:pb-4 [&_[data-slot=alert-dialog-title]]:text-xl [&_[data-slot=alert-dialog-footer]]:border-t [&_[data-slot=alert-dialog-footer]]:pt-4 [&_[data-slot=alert-dialog-footer]]:gap-2 [&_[data-slot=alert-dialog-footer]]:flex-col sm:[&_[data-slot=alert-dialog-footer]]:flex-row [&_[data-slot=alert-dialog-footer]>button]:w-full sm:[&_[data-slot=alert-dialog-footer]>button]:w-auto'

export const getDialogAppearance = (variant = 'default', kind = 'dialog') => {
  if (variant !== 'auna') return { overlay: undefined, content: undefined, close: undefined }

  return {
    overlay: 'bg-slate-950/70 backdrop-blur-[2px]',
    content: `${commonContent} ${kind === 'alert' ? alertSlots : dialogSlots}`,
    close: kind === 'dialog' ? 'z-20 grid size-10 place-items-center rounded-xl hover:bg-muted focus:ring-brand-orange' : undefined,
  }
}
