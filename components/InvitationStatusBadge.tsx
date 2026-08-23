'use client';

import { cn } from '@/lib/utils';
import { INVITATION_STATUS_CONFIG, type InvitationStatus } from '@/lib/invitation';

export function InvitationStatusBadge({ status, className }: { status: InvitationStatus; className?: string }) {
  const config = INVITATION_STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium',
        config.cls,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', config.dot)} />
      {config.label}
    </span>
  );
}
