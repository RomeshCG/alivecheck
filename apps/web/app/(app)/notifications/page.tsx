'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api, ApiError } from '@/lib/api';
import type { Provider } from '@/lib/types';

export default function NotificationsPage() {
  const [providers, setProviders] = useState<Provider[]>([]);

  async function load() {
    const data = await api<{ providers: Provider[] }>('/api/notification-providers');
    setProviders(data.providers);
  }

  useEffect(() => {
    void load().catch(() => undefined);
  }, []);

  async function test(id: string) {
    try {
      await api(`/api/notification-providers/${id}/test`, { method: 'POST' });
      toast.success('Test notification sent');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Test failed');
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this notification provider?')) return;
    await api(`/api/notification-providers/${id}`, { method: 'DELETE' });
    toast.success('Provider deleted');
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Alerts</h1>
          <p className="text-sm text-muted-foreground">SMTP and webhook notification providers.</p>
        </div>
        <Button asChild>
          <Link href="/notifications/new">
            <Plus className="h-4 w-4" />
            Add provider
          </Link>
        </Button>
      </div>

      <div className="space-y-3">
        {providers.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No providers yet. Add SMTP or a webhook.
            </CardContent>
          </Card>
        ) : (
          providers.map((provider) => (
            <Card key={provider.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">{provider.name}</CardTitle>
                  <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant="secondary">{provider.type}</Badge>
                    {provider.enabled ? null : <span>disabled</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="button" onClick={() => void test(provider.id)}>
                    Send test
                  </Button>
                  <Button type="button" variant="outline" onClick={() => void remove(provider.id)}>
                    Delete
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
