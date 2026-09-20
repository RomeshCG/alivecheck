'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, ApiError } from '@/lib/api';
import type { Provider } from '@/lib/types';

export default function NewMonitorPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [providers, setProviders] = useState<Provider[]>([]);

  useEffect(() => {
    api<{ providers: Provider[] }>('/api/notification-providers')
      .then((data) => setProviders(data.providers))
      .catch(() => undefined);
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const providerIds = form.getAll('providerIds').map(String);
    try {
      const created = await api<{ monitor: { id: string } }>('/api/monitors', {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          url: form.get('url'),
          method: form.get('method'),
          intervalSeconds: Number(form.get('intervalSeconds')),
          timeoutSeconds: Number(form.get('timeoutSeconds')),
          expectedStatus: Number(form.get('expectedStatus')),
          failureThreshold: Number(form.get('failureThreshold')),
          recoveryThreshold: Number(form.get('recoveryThreshold')),
          enabled: true,
          providerIds,
        }),
      });
      toast.success('Monitor created');
      router.replace(`/monitors/${created.monitor.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create monitor');
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New monitor</h1>
        <p className="text-sm text-muted-foreground">Only public HTTP/HTTPS URLs are allowed.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Endpoint</CardTitle>
          <CardDescription>Configure how AliveCheck probes your service.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required placeholder="Production API" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="url">URL</Label>
              <Input id="url" name="url" type="url" required placeholder="https://api.example.com/health" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="method">Method</Label>
                <select
                  id="method"
                  name="method"
                  defaultValue="GET"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
                >
                  <option>GET</option>
                  <option>HEAD</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="expectedStatus">Expected status</Label>
                <Input id="expectedStatus" name="expectedStatus" type="number" defaultValue={200} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="intervalSeconds">Interval (seconds)</Label>
                <Input id="intervalSeconds" name="intervalSeconds" type="number" min={30} defaultValue={60} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timeoutSeconds">Timeout (seconds)</Label>
                <Input id="timeoutSeconds" name="timeoutSeconds" type="number" min={1} defaultValue={10} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="failureThreshold">Failure threshold</Label>
                <Input id="failureThreshold" name="failureThreshold" type="number" min={1} defaultValue={3} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recoveryThreshold">Recovery threshold</Label>
                <Input id="recoveryThreshold" name="recoveryThreshold" type="number" min={1} defaultValue={2} />
              </div>
            </div>
            {providers.length > 0 ? (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Notify via</legend>
                {providers.map((provider) => (
                  <label key={provider.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="providerIds" value={provider.id} className="rounded border" />
                    {provider.name} ({provider.type})
                  </label>
                ))}
              </fieldset>
            ) : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button disabled={pending} type="submit">
              {pending ? 'Saving…' : 'Create monitor'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
