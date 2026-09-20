'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api, ApiError } from '@/lib/api';
import type { Incident, Monitor, MonitorCheck, Provider } from '@/lib/types';
import { formatMs, formatPercent, formatRelative } from '@/lib/utils';

export default function MonitorDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [monitor, setMonitor] = useState<Monitor | null>(null);
  const [checks, setChecks] = useState<MonitorCheck[]>([]);
  const [uptime, setUptime] = useState<Record<string, number | null>>({});
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProviderIds, setSelectedProviderIds] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const [monitorRes, checksRes, uptimeRes, incidentsRes, providersRes] = await Promise.all([
      api<{ monitor: Monitor }>(`/api/monitors/${params.id}`),
      api<{ checks: MonitorCheck[] }>(`/api/monitors/${params.id}/checks`),
      api<{ uptime: Record<string, number | null> }>(`/api/monitors/${params.id}/uptime`),
      api<{ incidents: Incident[] }>(`/api/monitors/${params.id}/incidents`),
      api<{ providers: Provider[] }>('/api/notification-providers'),
    ]);
    setMonitor(monitorRes.monitor);
    setChecks(checksRes.checks);
    setUptime(uptimeRes.uptime);
    setIncidents(incidentsRes.incidents);
    setProviders(providersRes.providers);
    setSelectedProviderIds(
      (monitorRes.monitor.notifications ?? [])
        .filter((n) => n.enabled)
        .map((n) => n.provider.id),
    );
  }

  useEffect(() => {
    void load().catch(() => undefined);
  }, [params.id]);

  const chartData = useMemo(
    () =>
      [...checks]
        .reverse()
        .slice(-60)
        .map((check) => ({
          time: new Date(check.checkedAt).toLocaleTimeString(),
          ms: check.responseTimeMs ?? 0,
        })),
    [checks],
  );

  async function checkNow() {
    setMessage(null);
    try {
      const result = await api<{
        status: string;
        httpStatus: number | null;
        responseTime: number;
        success: boolean;
        event: string | null;
        notified: boolean;
        consecutiveFailures: number;
        failureThreshold: number;
      }>(`/api/monitors/${params.id}/check`, { method: 'POST' });

      let text = `Check Now: ${result.status} · HTTP ${result.httpStatus ?? '—'} · ${result.responseTime} ms`;
      if (result.event) {
        text += ` · alert sent (${result.event})`;
        toast.success(text);
      } else if (!result.success) {
        text += ` · failures ${result.consecutiveFailures}/${result.failureThreshold} (email only on transition to DOWN)`;
        toast.message(text);
      } else {
        toast.success(text);
      }
      setMessage(text);
      await load();
    } catch (err) {
      const text = err instanceof ApiError ? err.message : 'Check failed';
      setMessage(text);
      toast.error(text);
    }
  }

  async function resendAlert() {
    try {
      const result = await api<{ event: string }>(`/api/monitors/${params.id}/notify`, {
        method: 'POST',
      });
      toast.success(`Alert sent (${result.event})`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not send alert');
    }
  }

  async function toggle() {
    if (!monitor) return;
    await api(`/api/monitors/${params.id}/${monitor.enabled ? 'pause' : 'resume'}`, { method: 'POST' });
    toast.success(monitor.enabled ? 'Monitor paused' : 'Monitor resumed');
    await load();
  }

  async function remove() {
    if (!confirm('Delete this monitor?')) return;
    await api(`/api/monitors/${params.id}`, { method: 'DELETE' });
    toast.success('Monitor deleted');
    router.replace('/monitors');
  }

  async function saveAlerts() {
    try {
      await api(`/api/monitors/${params.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ providerIds: selectedProviderIds }),
      });
      if (monitor?.currentStatus === 'DOWN' && selectedProviderIds.length > 0) {
        toast.success('Alert providers updated — DOWN email sent');
      } else {
        toast.success('Alert providers updated');
      }
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update alerts');
    }
  }

  function toggleProvider(id: string) {
    setSelectedProviderIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  if (!monitor) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{monitor.name}</h1>
          <p className="mt-1 font-mono text-sm text-muted-foreground">{monitor.url}</p>
        </div>
        <StatusBadge status={monitor.currentStatus} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void checkNow()}>
          Check Now
        </Button>
        <Button type="button" variant="outline" onClick={() => void toggle()}>
          {monitor.enabled ? 'Pause' : 'Resume'}
        </Button>
        {monitor.currentStatus === 'DOWN' ? (
          <Button type="button" variant="destructive" onClick={() => void resendAlert()}>
            Resend DOWN email
          </Button>
        ) : null}
        <Button type="button" variant="outline" onClick={() => void remove()}>
          Delete
        </Button>
      </div>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alert providers</CardTitle>
          <CardDescription>
            Choose who gets DOWN / RECOVERED emails for this monitor. If none are selected, all
            enabled providers are used.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {providers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No providers yet. Add SMTP under Alerts first.
            </p>
          ) : (
            providers.map((provider) => (
              <label key={provider.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="rounded border"
                  checked={selectedProviderIds.includes(provider.id)}
                  onChange={() => toggleProvider(provider.id)}
                />
                {provider.name} ({provider.type})
              </label>
            ))
          )}
          {providers.length > 0 ? (
            <Button type="button" variant="outline" onClick={() => void saveAlerts()}>
              Save alert links
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          ['1 hour', uptime.hour],
          ['24 hours', uptime.day],
          ['7 days', uptime.week],
          ['30 days', uptime.month],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <CardHeader className="pb-2">
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-2xl">{formatPercent(value as number | null)}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Response time</CardTitle>
          <CardDescription>Recent successful and failed probes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            {chartData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No checks yet. Use Check Now or wait for the worker.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" opacity={0.5} />
                  <XAxis dataKey="time" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                    }}
                    formatter={(value) => [`${value} ms`, 'Response']}
                  />
                  <Line type="monotone" dataKey="ms" stroke="var(--primary)" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent checks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {checks.slice(0, 20).map((check) => (
            <div key={check.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              <Badge variant={check.success ? 'success' : 'destructive'}>
                {check.success ? 'OK' : check.errorType ?? 'FAIL'}
              </Badge>
              <span className="text-muted-foreground">
                {check.statusCode ?? '—'} · {formatMs(check.responseTimeMs)} · {formatRelative(check.checkedAt)}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Incidents</CardTitle>
        </CardHeader>
        <CardContent>
          {incidents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No incidents recorded.</p>
          ) : (
            <div className="space-y-2">
              {incidents.map((incident) => (
                <div key={incident.id} className="rounded-lg border px-3 py-3 text-sm">
                  <p>
                    {new Date(incident.startedAt).toLocaleString()} →{' '}
                    {incident.resolvedAt ? new Date(incident.resolvedAt).toLocaleString() : 'ongoing'}
                  </p>
                  <p className="text-muted-foreground">{incident.errorSummary}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
