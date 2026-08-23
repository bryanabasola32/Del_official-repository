'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { FileSpreadsheet, UserPlus, CalendarPlus, ImagePlus } from 'lucide-react';

export interface QuickAction {
  icon: React.ElementType;
  label: string;
  desc?: string;
  onClick?: () => void;
  href?: string;
}

export interface QuickActionGroup {
  heading: string;
  actions: QuickAction[];
}

interface QuickActionMenuProps {
  groups: QuickActionGroup[];
  onNavigate?: (href: string) => void;
  triggerId?: string;
}

export function QuickActionMenu({ groups, onNavigate, triggerId }: QuickActionMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        const trigger = triggerId ? document.getElementById(triggerId) : null;
        if (trigger && trigger.contains(e.target as Node)) return;
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [triggerId]);

  useEffect(() => {
    const trigger = triggerId ? document.getElementById(triggerId) : null;
    if (!trigger) return;
    const clickHandler = () => setOpen((v) => !v);
    trigger.addEventListener('click', clickHandler);
    return () => trigger.removeEventListener('click', clickHandler);
  }, [triggerId]);

  const handleAction = (action: QuickAction) => {
    setOpen(false);
    if (action.href) {
      onNavigate?.(action.href);
    } else {
      action.onClick?.();
    }
  };

  if (!open) return null;

  return (
    <div ref={ref} className="absolute bottom-12 left-0 w-72 rounded-xl border border-border bg-popover shadow-lg z-50 animate-slide-up overflow-hidden">
      <div className="p-2">
        {groups.map((group, gi) => (
          <div key={gi}>
            {gi > 0 && <div className="my-1.5 mx-2 border-t border-border" />}
            <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              {group.heading}
            </div>
            {group.actions.map((action, ai) => {
              const Icon = action.icon;
              return (
                <button
                  key={ai}
                  onClick={() => handleAction(action)}
                  className="flex items-start gap-3 w-full rounded-lg p-2 text-left hover:bg-muted transition-colors"
                >
                  <Icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">{action.label}</div>
                    {action.desc && (
                      <div className="text-xs text-muted-foreground">{action.desc}</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export const defaultQuickActionGroups: QuickActionGroup[] = [
  {
    heading: 'Import Data',
    actions: [
      { icon: FileSpreadsheet, label: 'Executive List (.xlsx, .xls, .csv)', desc: 'Upload a spreadsheet roster' },
      { icon: FileSpreadsheet, label: 'Event List (.xlsx, .xls, .csv)', desc: 'Upload events from a spreadsheet' },
    ],
  },
  {
    heading: 'Create',
    actions: [
      { icon: UserPlus, label: 'Add Executive', desc: 'Single manual entry' },
      { icon: CalendarPlus, label: 'Create Event', desc: 'New DELCA event' },
      { icon: ImagePlus, label: 'Upload Event Photos', desc: 'Add photos to an event' },
    ],
  },
];
