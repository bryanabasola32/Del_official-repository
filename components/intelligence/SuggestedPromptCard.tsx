'use client';

import { cn } from '@/lib/utils';

interface SuggestedPrompt {
  icon?: React.ElementType;
  label: string;
  prompt: string;
}

interface SuggestedPromptCardProps {
  prompts: SuggestedPrompt[];
  onSelect: (prompt: string) => void;
  className?: string;
}

export function SuggestedPromptCard({ prompts, onSelect, className }: SuggestedPromptCardProps) {
  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 gap-2', className)}>
      {prompts.map((p, i) => {
        const Icon = p.icon;
        return (
          <button
            key={i}
            onClick={() => onSelect(p.prompt)}
            className="flex items-center gap-2.5 rounded-xl border border-border bg-card p-3 text-left hover:border-primary/30 hover:bg-muted/50 transition-all group"
          >
            {Icon && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </div>
            )}
            <span className="text-sm text-foreground group-hover:text-primary transition-colors">
              {p.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export type { SuggestedPrompt };
