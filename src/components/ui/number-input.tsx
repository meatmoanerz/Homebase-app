import * as React from "react"
import { cn } from "@/lib/utils/cn"

export interface NumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type'> {
  /**
   * Callback fired when the numeric value changes
   */
  onValueChange?: (value: number | undefined) => void
  /**
   * Whether to show error styling
   */
  error?: boolean
  /**
   * Allow decimal values (default: false, integers only)
   */
  allowDecimals?: boolean
}

/**
 * Enhanced number input component optimized for mobile keyboards.
 * Uses inputMode="numeric" to show the numeric keypad on mobile devices.
 * Automatically strips non-numeric characters and provides a clean numeric value.
 */
const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ className, error, onValueChange, allowDecimals = false, value, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState<string>(
      value !== undefined && value !== '' ? String(value) : ''
    )

    // Sync displayValue with controlled value prop
    React.useEffect(() => {
      if (value !== undefined && value !== '') {
        setDisplayValue(String(value))
      } else if (value === '' || value === undefined) {
        setDisplayValue('')
      }
    }, [value])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value

      // Allow empty string
      if (rawValue === '') {
        setDisplayValue('')
        onValueChange?.(undefined)
        return
      }

      // Build the allowed characters pattern
      const allowedPattern = allowDecimals ? /[^0-9.]/g : /[^0-9]/g

      // Remove non-numeric characters (keep dots if decimals allowed)
      let cleanedValue = rawValue.replace(allowedPattern, '')

      // If decimals allowed, ensure only one decimal point
      if (allowDecimals) {
        const parts = cleanedValue.split('.')
        if (parts.length > 2) {
          cleanedValue = parts[0] + '.' + parts.slice(1).join('')
        }
      }

      setDisplayValue(cleanedValue)

      // Parse and emit the numeric value
      if (cleanedValue === '' || cleanedValue === '.') {
        onValueChange?.(undefined)
      } else {
        const numValue = allowDecimals ? parseFloat(cleanedValue) : parseInt(cleanedValue, 10)
        if (!isNaN(numValue)) {
          onValueChange?.(numValue)
        }
      }
    }

    return (
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        pattern={allowDecimals ? "[0-9]*\\.?[0-9]*" : "[0-9]*"}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck="false"
        value={displayValue}
        onChange={handleChange}
        className={cn(
          "flex h-11 w-full rounded-lg border-2 border-input bg-white dark:bg-input px-4 py-2 text-base text-foreground transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-hb-tim focus-visible:ring-2 focus-visible:ring-hb-tim/20 disabled:cursor-not-allowed disabled:opacity-50",
          error && "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20",
          className
        )}
        {...props}
      />
    )
  }
)
NumberInput.displayName = "NumberInput"

export { NumberInput }
