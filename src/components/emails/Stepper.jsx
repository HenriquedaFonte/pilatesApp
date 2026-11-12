import React from 'react'
import { Check } from 'lucide-react'

// Indicador dos 3 passos. Só deixa voltar para passos já feitos.
const Stepper = ({ steps, current, onGoTo, disabled = false }) => (
  <ol className="grid grid-cols-3 gap-2" aria-label="steps">
    {steps.map((label, index) => {
      const number = index + 1
      const done = number < current
      const active = number === current
      const clickable = done && !disabled
      return (
        <li key={label}>
          <button
            type="button"
            onClick={() => clickable && onGoTo(number)}
            disabled={!clickable}
            aria-current={active ? 'step' : undefined}
            className={`w-full flex flex-col sm:flex-row items-center gap-1.5 sm:gap-2.5 rounded-xl px-2 py-2.5 sm:px-3 text-center sm:text-left transition-colors ${
              active
                ? 'bg-primary/10 text-foreground'
                : done
                ? 'text-foreground hover:bg-muted/50'
                : 'text-muted-foreground'
            } ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                active
                  ? 'bg-primary text-primary-foreground'
                  : done
                  ? 'bg-primary/15 text-primary'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {done ? <Check className="h-4 w-4" /> : number}
            </span>
            <span className={`text-xs sm:text-sm leading-tight ${active ? 'font-semibold' : 'font-medium'}`}>
              {label}
            </span>
          </button>
        </li>
      )
    })}
  </ol>
)

export default Stepper
