import { cn } from "@/lib/utils/cn"
import { Loader2 } from "lucide-react"

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg"
  className?: string
}

export function LoadingSpinner({ size = "md", className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  }

  return (
    <Loader2 
      className={cn(
        "animate-spin text-hb-cognac",
        sizeClasses[size],
        className
      )} 
    />
  )
}

export function LoadingPage() {
  return (
    <div className="flex h-[80vh] w-full items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <LoadingSpinner size="lg" />
        <p className="text-sm text-muted-foreground">Laddar...</p>
      </div>
    </div>
  )
}

export function LoadingCard() {
  return (
    <div className="flex h-40 w-full items-center justify-center rounded-2xl bg-card border border-border">
      <LoadingSpinner size="md" />
    </div>
  )
}

