'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import type { Monitor } from '@/lib/types';
import { formatRelative } from '@/lib/utils';

export default function MonitorsPage() {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ monitors: Monitor[] }>('/api/monitors')
      .then((data) => setMonitors(data.monitors))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Monitors</h1>
          <p className="text-sm text-muted-foreground">Manage HTTPS endpoints and check intervals.</p>
        </div>
        <Button asChild>
          <Link href="/monitors/new">
            <Plus className="h-4 w-4" />
            Add monitor
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All monitors</CardTitle>
          <CardDescription>{loading ? 'Loading…' : `${monitors.length} configured`}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : monitors.length === 0 ? (
            <p className="text-sm text-muted-foreground">No monitors yet.</p>
          ) : (
            monitors.map((monitor) => (
              <Link
                key={monitor.id}
                href={`/monitors/${monitor.id}`}
                className="flex items-center justify-between gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <p className="font-medium">{monitor.name}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">{monitor.url}</p>
                </div>
                <div className="text-right">
                  <StatusBadge status={monitor.currentStatus} />
                  <p className="mt-1 text-xs text-muted-foreground">{formatRelative(monitor.lastCheckedAt)}</p>
                </div>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
