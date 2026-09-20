'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, ApiError } from '@/lib/api';

export default function NewNotificationPage() {
  const router = useRouter();
  const [type, setType] = useState<'SMTP' | 'WEBHOOK'>('SMTP');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const payload =
        type === 'SMTP'
          ? {
              type,
              name: form.get('name'),
              enabled: true,
              config: {
                host: form.get('host'),
                port: Number(form.get('port')),
                secure: form.get('secure') === 'on',
                user: String(form.get('user') || ''),
                password: String(form.get('password') || ''),
                from: form.get('from'),
                to: form.get('to'),
              },
            }
          : {
              type,
              name: form.get('name'),
              enabled: true,
              config: {
                url: form.get('url'),
                secret: String(form.get('secret') || '') || undefined,
              },
            };
      await api('/api/notification-providers', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      toast.success('Provider saved');
      router.replace('/notifications');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save provider');
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New notification provider</h1>
        <p className="text-sm text-muted-foreground">Credentials are encrypted at rest.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Provider</CardTitle>
          <CardDescription>SMTP email or a generic webhook POST.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required placeholder="Ops email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <select
                id="type"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
                value={type}
                onChange={(event) => setType(event.target.value as 'SMTP' | 'WEBHOOK')}
              >
                <option value="SMTP">SMTP</option>
                <option value="WEBHOOK">Webhook</option>
              </select>
            </div>
            {type === 'SMTP' ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="host">SMTP host</Label>
                  <Input id="host" name="host" required placeholder="smtp.example.com" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="port">Port</Label>
                    <Input id="port" name="port" type="number" defaultValue={587} required />
                  </div>
                  <label className="flex items-end gap-2 pb-2 text-sm">
                    <input type="checkbox" name="secure" className="rounded border" />
                    Port 465 implicit TLS (leave off for Gmail 587)
                  </label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user">Username</Label>
                  <Input id="user" name="user" autoComplete="off" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" name="password" type="password" autoComplete="new-password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="from">From</Label>
                  <Input id="from" name="from" type="email" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="to">To</Label>
                  <Input id="to" name="to" type="email" required />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="url">Webhook URL</Label>
                  <Input id="url" name="url" type="url" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secret">Shared secret (optional)</Label>
                  <Input id="secret" name="secret" />
                </div>
              </>
            )}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button disabled={pending} type="submit">
              {pending ? 'Saving…' : 'Save provider'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
