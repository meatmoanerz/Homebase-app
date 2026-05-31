import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils/cn"

/**
 * Homebase button system — flat colors, no gradients.
 * Matches the editorial design: warm darks and cognac accents.
 *
 * Variants:
 *  default   → primary action, dark warm background (hb-nav)
 *  cognac    → secondary CTA, cognac/gold tone
 *  outline   → bordered, transparent — for less prominent actions
 *  ghost     → no background, hover only
 *  destructive → red, for delete actions
 *  success   → green confirmation
 *  link      → text link style
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.97]",
  {
    variants: {
      variant: {
        // Dark warm — main CTA
        default:
          "bg-hb-nav text-hb-nav-foreground hover:opacity-90 shadow-sm",
        // Cognac — accent CTA
        cognac:
          "bg-hb-cognac text-hb-nav hover:opacity-90 shadow-sm",
        // Destructive
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm",
        // Outlined — secondary
        outline:
          "border border-border bg-transparent hover:bg-secondary text-foreground",
        // Outlined cognac
        "outline-cognac":
          "border border-hb-cognac/60 bg-transparent hover:bg-hb-cognac/8 text-hb-cognac-deep",
        // Ghost
        ghost:
          "bg-transparent hover:bg-secondary text-muted-foreground hover:text-foreground",
        success:
          "bg-success text-white hover:bg-success/90 shadow-sm",
        link:
          "text-hb-cognac-deep underline-offset-4 hover:underline bg-transparent p-0 h-auto font-medium",
      },
      size: {
        default: "h-11 px-5 py-2 text-sm",
        sm:      "h-9 px-4 text-xs rounded-full",
        lg:      "h-12 px-7 text-sm",
        xl:      "h-14 px-8 text-base",
        icon:    "h-11 w-11 rounded-full",
        "icon-sm": "h-9 w-9 rounded-full",
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
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
