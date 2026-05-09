import * as React from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'ghost' | 'link' | 'secondary'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    const variants = {
      default: 'bg-blue-600 text-white hover:bg-blue-700 shadow',
      destructive: 'bg-red-600 text-white hover:bg-red-700 shadow',
      outline: 'border border-slate-600 bg-transparent text-slate-200 hover:bg-slate-700/50',
      ghost: 'bg-transparent text-slate-200 hover:bg-slate-700/50',
      link: 'bg-transparent text-blue-400 underline-offset-4 hover:underline',
      secondary: 'bg-slate-700 text-slate-100 hover:bg-slate-600 shadow',
    }
    const sizes = {
      default: 'h-9 px-4 py-2 text-sm',
      sm: 'h-7 px-3 text-xs',
      lg: 'h-11 px-6 text-base',
      icon: 'h-9 w-9',
    }
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
          'disabled:pointer-events-none disabled:opacity-50',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button }
