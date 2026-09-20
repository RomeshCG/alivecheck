'use client';

import type { MonitorStatus } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const labels: Record<MonitorStatus, string> = {
  NEW: 'Waiting',
  UP: 'Up',
  DOWN: 'Down',
  RECOVERED: 'Recovered',
};

export function StatusBadge({ status, className }: { status: MonitorStatus; className?: string }) {
  const variant =
    status === 'DOWN' ? 'destructive' : status === 'NEW' ? 'warning' : status === 'UP' || status === 'RECOVERED' ? 'success' : 'secondary';

  return (
    <Badge variant={variant} className={cn('gap-1.5', className)}>
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          status === 'DOWN' && 'bg-destructive',
          status === 'NEW' && 'bg-warning',
          (status === 'UP' || status === 'RECOVERED') && 'bg-primary',
        )}
      />
      {labels[status]}
    </Badge>
  );
}
