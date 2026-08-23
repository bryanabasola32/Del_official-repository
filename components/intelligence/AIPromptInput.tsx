'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Plus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIPromptInputProps {
  onSend: (text: string) => void;
  onQuickAction?: () => void;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
  quickActionTriggerId?: string;
  value?: string;
  onChange?: (value: string) => void;
}

export function AIPromptInput({
  onSend,
  onQuickAction,
  disabled = false,
  placeholder = 'Ask DEL to enrich executives, analyze events, generate invitations, or create reports...',
  maxLength = 2000,
  quickActionTriggerId = 'quick-action-trigger',
  value: controlledValue,
  onChange,
}: AIPromptInputProps) {
  const [internalValue, setInternalValue] = useState('');
  const value = controlledValue !== undefined ? controlledValue : internalValue;
  const setValue = (v: string) => {
    if (onChange) onChange(v);
    else setInternalValue(v);
  };
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, []);

  useEffect(() => {
    autoResize();
  }, [value, autoResize]);

  const handleSend = () => {
    if (!value.trim() || disabled) return;
    onSend(value.trim());
    setValue('');
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex items-end gap-2">
      <button
        id={quickActionTriggerId}
        onClick={onQuickAction}
        disabled={disabled}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-foreground hover:bg-muted hover:border-primary/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Quick actions"
      >
        <Plus className="h-5 w-5" />
      </button>
      <div className="relative flex-1">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, maxLength))}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          rows={1}
          className={cn(
            'w-full resize-none rounded-xl border border-border bg-card px-4 py-3 pr-28 text-sm leading-relaxed',
            'placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40',
            'disabled:opacity-60 disabled:cursor-not-allowed scrollbar-thin'
          )}
        />
        <div className="absolute bottom-2.5 right-2.5 flex items-center gap-2">
          {value.length > 0 && (
            <span className="text-[10px] text-muted-foreground/60 tabular-nums">
              {value.length}/{maxLength}
            </span>
          )}
          <button
            onClick={handleSend}
            disabled={disabled || !value.trim()}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Send"
          >
            {disabled ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
