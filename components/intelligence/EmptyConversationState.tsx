'use client';

import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyConversationStateProps {
  className?: string;
}

export function EmptyConversationState({ className }: EmptyConversationStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-4 text-center', className)}>
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
        <Sparkles className="h-8 w-8" />
      </div>
      <h2 className="text-xl font-semibold text-foreground mb-1.5">Welcome to DEL Intelligence</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        Use the command bar below to ask DEL for assistance.
      </p>
    </div>
  );
}
