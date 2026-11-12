import React from 'react'
import { CheckCircle, Globe } from 'lucide-react'
import { TEMPLATE_CARDS, pick } from '../lib/templateCards'

const EmailTemplates = ({ onSelectTemplate, selectedTemplateId, language = 'pt', disabled = false }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
    {Object.entries(TEMPLATE_CARDS).map(([id, card]) => {
      const Icon = card.icon
      const isSelected = selectedTemplateId === id
      return (
        <button
          key={id}
          type="button"
          disabled={disabled}
          onClick={() => onSelectTemplate(id)}
          aria-pressed={isSelected}
          className={`text-left rounded-xl border p-4 min-h-[76px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60 ${
            isSelected
              ? 'border-primary ring-1 ring-primary bg-primary/5'
              : 'border-border bg-background hover:bg-muted/40'
          }`}
        >
          <div className="flex items-start gap-3">
            <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${card.color}`} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-foreground">
                  {pick(card.title, language)}
                </span>
                {(card.automatic || card.fullMessage) && (
                  <Globe className="h-3.5 w-3.5 text-teal-600 shrink-0" aria-hidden="true" />
                )}
                {isSelected && <CheckCircle className="h-4 w-4 text-primary shrink-0 ml-auto" />}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                {pick(card.description, language)}
              </p>
            </div>
          </div>
        </button>
      )
    })}
  </div>
)

export default EmailTemplates
