import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "relative overflow-hidden inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow hover:bg-primary-hover hover:shadow-lg",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive-hover hover:shadow-lg",
        warning:
          "bg-warning text-warning-foreground shadow-sm hover:bg-warning-hover hover:shadow-lg",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent-hover hover:text-accent-foreground hover:border-accent hover:shadow-md",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary-hover hover:shadow-md",
        ghost: "hover:bg-muted-hover hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

interface ClickEffect {
  id: number
  x: number
  y: number
  size: number
}

const effectIdCounter = { current: 0 }

const getEffectColors = (variant: string | null | undefined) => {
  switch (variant) {
    case "outline":
    case "ghost":
      return {
        ripple: "bg-foreground/15",
        ring: "border-foreground/25",
        flash: "bg-foreground/30",
      }
    case "link":
      return {
        ripple: "bg-primary/20",
        ring: "border-primary/30",
        flash: "bg-primary/40",
      }
    case "destructive":
    case "warning":
      return {
        ripple: "bg-white/25",
        ring: "border-white/40",
        flash: "bg-white/50",
      }
    default:
      return {
        ripple: "bg-white/30",
        ring: "border-white/50",
        flash: "bg-white/60",
      }
  }
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, onClick, ...props }, ref) => {
    const [effects, setEffects] = React.useState<ClickEffect[]>([])
    const [isPressed, setIsPressed] = React.useState(false)

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      const button = e.currentTarget
      const rect = button.getBoundingClientRect()
      const effectSize = Math.max(rect.width, rect.height)
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      const newEffect: ClickEffect = {
        id: effectIdCounter.current++,
        x,
        y,
        size: effectSize,
      }

      setEffects((prev) => [...prev, newEffect])
      setIsPressed(true)

      setTimeout(() => {
        setEffects((prev) => prev.filter((effect) => effect.id !== newEffect.id))
      }, 600)

      setTimeout(() => {
        setIsPressed(false)
      }, 250)

      onClick?.(e)
    }

    const colors = getEffectColors(variant)

    if (asChild) {
      return (
        <Slot
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          {...props}
        />
      )
    }

    return (
      <button
        className={cn(
          buttonVariants({ variant, size, className }),
          isPressed && "animate-press"
        )}
        ref={ref}
        onClick={handleClick}
        {...props}
      >
        {effects.map((effect) => (
          <React.Fragment key={effect.id}>
            {/* Click flash - small bright burst at click point */}
            <span
              className={cn(
                "absolute rounded-full animate-click-flash pointer-events-none",
                colors.flash
              )}
              style={{
                left: effect.x - effect.size * 0.15,
                top: effect.y - effect.size * 0.15,
                width: effect.size * 0.3,
                height: effect.size * 0.3,
              }}
            />
            {/* Ripple ring - expanding border */}
            <span
              className={cn(
                "absolute rounded-full border-2 animate-ripple-ring pointer-events-none bg-transparent",
                colors.ring
              )}
              style={{
                left: effect.x - effect.size * 0.5,
                top: effect.y - effect.size * 0.5,
                width: effect.size,
                height: effect.size,
              }}
            />
            {/* Main ripple - filled expanding circle */}
            <span
              className={cn(
                "absolute rounded-full animate-ripple pointer-events-none",
                colors.ripple
              )}
              style={{
                left: effect.x - effect.size,
                top: effect.y - effect.size,
                width: effect.size * 2,
                height: effect.size * 2,
              }}
            />
          </React.Fragment>
        ))}
        {props.children}
      </button>
    )
  }
)
Button.displayName = "Button"

export { Button }
