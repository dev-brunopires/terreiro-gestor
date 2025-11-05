import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // base de TODOS os botões: visível, com borda suave e transições
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-neutral-200 " +
    "bg-white text-neutral-800 shadow-sm transition-colors duration-150 " +
    "hover:bg-primary hover:text-primary-foreground hover:border-transparent " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 " +
    "disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // padrão: branco com borda, hover fica roxo
        default:
          "bg-white border-neutral-200 text-neutral-800",

        // sólido já começa roxo
        solid:
          "bg-primary text-primary-foreground border-transparent " +
          "hover:bg-primary/90",

        // contornado com texto roxo; hover sólido roxo
        outline:
          "bg-transparent border-neutral-300 text-primary " +
          "hover:bg-primary hover:text-primary-foreground hover:border-transparent",

        // "fantasma"/ghost com fundo claro; hover roxo
        ghost:
          "bg-neutral-50 border-transparent text-neutral-800 " +
          "hover:bg-primary hover:text-primary-foreground",

        // secundário com estilo neutro
        secondary:
          "bg-neutral-100 border-neutral-200 text-neutral-700 " +
          "hover:bg-neutral-200",

        // destrutivo (mantém semântico, mas ainda padronizado)
        destructive:
          "bg-red-600 text-white border-transparent hover:bg-red-600/90",
      },
      size: {
        default: "h-10 px-4 text-sm",
        sm: "h-9 px-3 text-sm",
        lg: "h-11 px-5 text-base",
        icon: "h-10 w-10 p-0",
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

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
