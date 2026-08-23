'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Bell, AlertTriangle, CheckCircle2, Info, Clock, ChevronRight } from 'lucide-react';
import type { NotificationItem } from '@/lib/types';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  loading: boolean;
  onNavigate?: (href: string) => void;
}

const SEVERITY_CONFIG = {
  warning: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800' },
  success: { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' },
  info: { icon: Info, color: 'text-blue-500', bg: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' },
};

export function NotificationsPanel({ open, onClose, notifications, loading, onNavigate }: Props) {
  const getNavHref = (n: NotificationItem): string | null => {
    if (n.contactId) return `/executives/${n.contactId}`;
    if (n.eventId) return `/events/${n.eventId}`;
    return null;
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-md p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </SheetTitle>
          <SheetDescription>
            Freshness reminders and completed background tasks
          </SheetDescription>
        </SheetHeader>

        <div className="overflow-y-auto scrollbar-thin h-[calc(100vh-120px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Bell className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">All caught up</p>
              <p className="text-xs mt-1">No pending notifications</p>
            </div>
          ) : (
            <div className="p-4 space-y-2">
              {notifications.map((n) => {
                const config = SEVERITY_CONFIG[n.severity];
                const Icon = config.icon;
                const href = getNavHref(n);
                const clickable = !!href && !!onNavigate;
                return (
                  <div
                    key={n.id}
                    onClick={clickable ? () => onNavigate!(href!) : undefined}
                    className={cn(
                      'flex gap-3 rounded-lg border p-3 transition-colors',
                      config.bg,
                      clickable && 'cursor-pointer hover:bg-muted/50',
                    )}
                  >
                    <Icon className={cn('h-5 w-5 shrink-0 mt-0.5', config.color)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">{n.title}</p>
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                          <Clock className="h-3 w-3" />
                          {timeAgo(n.timestamp)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{n.message}</p>
                    </div>
                    {clickable && (
                      <ChevronRight className="h-4 w-4 shrink-0 self-center text-muted-foreground" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
