import React, { useState } from 'react';
import { AppPluginMeta, PluginConfigPageProps } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { Alert, Button, Field, Input, useStyles2 } from '@grafana/ui';
import { errorText } from '../types';
import { api } from '../api';
import { getStyles } from './styles';

export function ConnectionSettings({ plugin }: PluginConfigPageProps<AppPluginMeta>) {
  const s = useStyles2(getStyles);
  const [url, setUrl] = useState<string>(plugin.meta.jsonData?.runnerUrl || '');
  const [token, setToken] = useState('');
  const [configured, setConfigured] = useState(!!plugin.meta.secureJsonFields?.runnerToken);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const managed = !!plugin.meta.jsonData?.managedByDeployment;
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (managed) {
      return;
    }
    setError('');
    setNotice('');
    try {
      const parsed = new URL(url);
      if (
        !['http:', 'https:'].includes(parsed.protocol) ||
        parsed.username ||
        parsed.password ||
        parsed.search ||
        parsed.hash
      ) {
        throw new Error();
      }
    } catch {
      setError('Érvényes HTTP(S) runner-alapcím szükséges, például http://relay:8091.');
      return;
    }
    if ((!configured || token) && token.length < 32) {
      setError('Legalább 32 karakteres API-token szükséges.');
      return;
    }
    setBusy(true);
    try {
      await getBackendSrv().post(`/api/plugins/${plugin.meta.id}/settings`, {
        enabled: plugin.meta.enabled ?? true,
        pinned: plugin.meta.pinned ?? true,
        jsonData: { ...plugin.meta.jsonData, runnerUrl: url.replace(/\/+$/, '') },
        secureJsonData: token ? { runnerToken: token } : {},
      });
      setConfigured(true);
      setToken('');
      setNotice('A kapcsolat beállításai mentve.');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function test() {
    setBusy(true);
    setNotice('');
    setError('');
    try {
      const status = await api<{ state?: string }>('status');
      setNotice(`A mentett runner-kapcsolat működik. Relay állapota: ${status.state || 'ismeretlen'}.`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={s.page}>
      <h2>Relay kapcsolat</h2>
      <p>A Grafana backendje ezen az API-n keresztül kezeli a relayt. A runner külön gépen is futhat.</p>
      {managed && (
        <Alert title="A kapcsolatot a telepítés kezeli" severity="info">
          A cím és a token a szerver telepítési beállításaiban módosítható. Az agenteket az Agentek és gépek oldalon
          kezelheted.
        </Alert>
      )}
      {error && (
        <Alert title="A kapcsolat beállítása nem sikerült" severity="error">
          {error}
        </Alert>
      )}
      {notice && (
        <Alert title="Relay kapcsolat" severity="success">
          {notice}
        </Alert>
      )}
      <form onSubmit={save}>
        <Field
          label="Runner API alapcíme"
          htmlFor="runner-url"
          description="A Grafana szerveréről elérhető cím. Távoli eléréshez HTTPS vagy tailnet használható."
        >
          <Input
            id="runner-url"
            disabled={managed}
            value={url}
            placeholder="http://relay:8091"
            onChange={(e) => setUrl(e.currentTarget.value)}
          />
        </Field>
        <Field
          label="Runner API-token"
          htmlFor="runner-token"
          description={
            configured
              ? 'Token tárolva. Üresen hagyva a meglévő token marad érvényben.'
              : 'A runner KFGYR_RUNNER_API_TOKEN beállításával megegyező titok.'
          }
        >
          <Input
            id="runner-token"
            disabled={managed}
            type="password"
            autoComplete="new-password"
            value={token}
            placeholder={configured ? 'Token már beállítva' : 'Legalább 32 karakter'}
            onChange={(e) => setToken(e.currentTarget.value)}
          />
        </Field>
        <div className={s.actions}>
          <Button type="submit" disabled={busy || managed}>
            Kapcsolat mentése
          </Button>
          <Button type="button" variant="secondary" disabled={busy || !configured} onClick={test}>
            Mentett kapcsolat ellenőrzése
          </Button>
        </div>
      </form>
    </div>
  );
}
