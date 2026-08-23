'use client';

import { cn } from '@/lib/utils';
import type { AIResponseData } from './ConversationBubble';

interface AIResponseCardProps {
  data: AIResponseData;
  className?: string;
}

export function AIResponseCard({ data, className }: AIResponseCardProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {data.sections.map((section, i) => (
        <div key={i} className="rounded-lg border border-border bg-background/50 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <span className={cn(
              'h-2 w-2 rounded-full',
              section.type === 'summary' && 'bg-primary',
              section.type === 'key_findings' && 'bg-amber-500',
              section.type === 'recommendations' && 'bg-emerald-500',
              section.type === 'reliability' && 'bg-blue-500',
              section.type === 'evidence' && 'bg-purple-500',
            )} />
            <span className="text-xs font-semibold uppercase tracking-wide text-foreground">{section.title}</span>
          </div>
          <ul className="space-y-1">
            {section.items.map((item, j) => (
              <li key={j} className="text-xs text-muted-foreground flex items-start gap-1.5">
                <span className="text-primary mt-0.5">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
