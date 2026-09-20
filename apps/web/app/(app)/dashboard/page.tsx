'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Activity, ArrowRight, Plus } from 'lucide-react';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import type { Monitor } from '@/lib/types';
import { formatRelative } from '@/lib/utils';

export default function DashboardPage() {
  const [data, setData] = useState<{
    total: number;
    up: number;
    down: number;
    monitors: Monitor[];
  } | null>(null);

  useEffect(() => {
    const load = () =>
      api<{ total: number; up: number; down: number; monitors: Monitor[] }>('/api/dashboard/summary')
        .then(setData)
        .catch(() => undefined);
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {data
              ? data.total === 0
                ? 'No monitors yet. Create one to start checking a public HTTPS endpoint.'
                : `${data.up} / ${data.total} services operational`
              : 'Loading overview…'}
          </p>
        </div>
        <Button asChild>
          <Link href="/monitors/new">
            <Plus className="h-4 w-4" />
            New monitor
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total</CardDescription>
            <CardTitle className="text-3xl">{data?.total ?? '—'}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Up</CardDescription>
            <CardTitle className="text-3xl text-primary">{data?.up ?? '—'}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Down</CardDescription>
            <CardTitle className="text-3xl text-destructive">{data?.down ?? '—'}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" />
            Monitors
          </CardTitle>
          <CardDescription>Live status across your endpoints</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {!data ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : data.monitors.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="text-sm text-muted-foreground">No monitors yet.</p>
              <Button asChild className="mt-4" variant="outline">
                <Link href="/monitors/new">Create your first monitor</Link>
              </Button>
            </div>
          ) : (
            data.monitors.map((monitor) => (
              <Link
                key={monitor.id}
                href={`/monitors/${monitor.id}`}
                className="flex items-center justify-between gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <p className="font-medium">{monitor.name}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">{monitor.url}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Last checked: {formatRelative(monitor.lastCheckedAt)}
                    {monitor.enabled ? '' : ' · paused'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={monitor.currentStatus} />
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
