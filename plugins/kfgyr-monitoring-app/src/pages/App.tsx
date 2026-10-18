import React, { useEffect, useState } from 'react';
import { getBackendSrv, PluginPage } from '@grafana/runtime';
import { Alert, Button, Field, Input, Switch } from '@grafana/ui';
import { lastValueFrom } from 'rxjs';

type Device = { id: string; alias: string; [key: string]: unknown };
type Agent = { alias: string; url: string; retention?: string; ignore?: boolean; devices: Device[]; [key: string]: unknown };
type Setup = { client: { name: string; timezone: string; [key: string]: unknown }; relay: { agents: Agent[]; [key: string]: unknown }; [key: string]: unknown };
type Snapshot = { revision: string; config: Setup; yaml: string };
type RunnerStatus = { state?: string; revision?: string; requested_revision?: string; failed_revision?: string; message?: string; updated_at?: string; pid?: number };
type FoundDevice = { id: string; name: string; uuid: string };
const root = '/api/plugins/kfgyr-monitoring-app/resources';
async function api<T>(path: string, method = 'GET', data?: unknown): Promise<T> {
  const result = await lastValueFrom(getBackendSrv().fetch<T>({ url: `${root}/${path}`, method, data }));
  return result.data;
}
function errorText(e: any) { return e?.data?.message || e?.message || 'A művelet sikertelen.'; }
const card: React.CSSProperties = { border: '1px solid rgba(128,128,128,.3)', borderRadius: 8, padding: 20, marginBottom: 20 };
const row: React.CSSProperties = { display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' };

export function App() {
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [setup, setSetup] = useState<Setup>();
  const [status, setStatus] = useState<RunnerStatus>({});
  const [selected, setSelected] = useState<number | null>(null);
  const [draft, setDraft] = useState<Agent>();
  const [found, setFound] = useState<FoundDevice[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const states: Record<string, string> = { starting: 'Indul', applying: 'Konfiguráció alkalmazása', running: 'Relay folyamat fut', failed: 'Sikertelen alkalmazás', stopped: 'Leállítva', waiting: 'Konfigurációra vár', restarting: 'Újraindul' };
  async function load() {
    const next = await api<Snapshot>('config');
    setSnapshot(next); setSetup(next.config); setDirty(false); setDraft(undefined);
  }
  useEffect(() => {
    load().catch(e => setError(errorText(e)));
    const poll = () => api<RunnerStatus>('status').then(setStatus).catch(() => {});
    poll(); const timer = setInterval(poll, 3000); return () => clearInterval(timer);
  }, []);
  function edit(index: number | null) {
    setError(''); setFound([]); setSelected(index);
    setDraft(index === null ? { alias: '', url: '', retention: '1week', devices: [] } : JSON.parse(JSON.stringify(setup!.relay.agents[index])));
  }
  function keepDraft() {
    if (!draft || !setup) { return; }
    if (!draft.alias.trim() || !draft.url.trim()) { setError('Az agent aliasa és URL-je kötelező.'); return; }
    const agents = [...setup.relay.agents];
    if (selected === null) { agents.push(draft); } else { agents[selected] = draft; }
    setSetup({ ...setup, relay: { ...setup.relay, agents } }); setDraft(undefined); setDirty(true); setError('');
  }
  async function probe() {
    if (!draft) { return; }
    setBusy(true); setError('');
    try { const result = await api<{ devices: FoundDevice[] }>('probe', 'POST', { url: draft.url }); setFound(result.devices); setNotice(`${result.devices.length} eszközt találtunk. A hozzáadás az aliasbeállítások közé történik.`); }
    catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  async function save() {
    if (!snapshot || !setup) { return; }
    if (!window.confirm('Alkalmazzuk a módosításokat? A relay újraindul, az adatgyűjtés rövid időre megszakad. Az új megőrzési idő később történeti adatokat is törölhet.')) { return; }
    setBusy(true); setError(''); setNotice('');
    try { const next = await api<Snapshot>('config', 'PUT', { base_revision: snapshot.revision, config: setup }); setSnapshot(next); setSetup(next.config); setDirty(false); setNotice('A konfiguráció mentve. A runner állapota jelzi az alkalmazás eredményét.'); }
    catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  async function rollback() {
    if (!snapshot || !status.revision || !window.confirm('Visszaállítod a konfigurációt a runner által jelenleg használt verzióra?')) { return; }
    setBusy(true); setError('');
    try { const next = await api<Snapshot>('rollback', 'POST', { base_revision: snapshot.revision, revision: status.revision }); setSnapshot(next); setSetup(next.config); setDirty(false); setNotice('A visszaállítás mentve.'); }
    catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  if (!setup) { return <PluginPage><Alert title={error || 'Konfiguráció betöltése…'} severity={error ? 'error' : 'info'} /></PluginPage>; }
  return <PluginPage>
    <h1>Agentek és gépek</h1>
    <p>MTConnect kapcsolatok kezelése. A mentés a relay folyamatának újraindításával lép életbe.</p>
    {error && <Alert title="A művelet sikertelen" severity="error">{error}</Alert>}
    {notice && <Alert title={notice} severity="info" />}
    <div style={card}>
      <strong>{states[status.state || ''] || 'Runner állapota nem érhető el'}</strong>
      <p>{status.message}</p>
      <small>Mentett verzió: {snapshot?.revision} · Futó verzió: {status.revision || '—'} · Frissítve: {status.updated_at || '—'}</small>
      <p>A futó folyamat állapota önmagában nem igazolja az adatbeérkezést. Az elérhetőség a Kapcsolat ellenőrzése gombbal vizsgálható.</p>
      {status.failed_revision && <Alert title={`Sikertelen verzió: ${status.failed_revision}`} severity="warning">Ellenőrizd a runner naplóját; a korábbi konfigurációra visszaállhatott.</Alert>}
      {status.failed_revision && status.revision && status.revision !== snapshot?.revision && <Button variant="secondary" onClick={rollback} disabled={busy || dirty || !!draft}>Visszaállítás a futó konfigurációra</Button>}
    </div>
    <div style={card}><div style={row}>
      <Field label="Monitoring neve"><Input value={setup.client.name} onChange={e => { setSetup({ ...setup, client: { ...setup.client, name: e.currentTarget.value } }); setDirty(true); }} /></Field>
      <Field label="Időzóna"><Input value={setup.client.timezone} onChange={e => { setSetup({ ...setup, client: { ...setup.client, timezone: e.currentTarget.value } }); setDirty(true); }} /></Field>
    </div></div>
    <div style={row}><Button onClick={() => edit(null)} disabled={!!draft || busy}>Agent hozzáadása</Button><Button variant="primary" onClick={save} disabled={!dirty || busy || !!draft}>Mentés és alkalmazás</Button><Button variant="secondary" onClick={() => { if (!dirty || window.confirm('Elveted a nem mentett módosításokat?')) { load().catch(e => setError(errorText(e))); } }} disabled={busy}>Újratöltés</Button>{dirty && <span>Nem mentett módosítások</span>}</div>
    <div style={{ marginTop: 20 }}>{setup.relay.agents.length === 0 && <p>Nincs konfigurált agent.</p>}{setup.relay.agents.map((agent, index) => <div style={card} key={`${agent.alias}-${index}`}>
      <h3>{agent.alias} {agent.ignore && <small>· letiltva</small>}</h3><p>{agent.url} · Megőrzés: {agent.retention || 'örökölt'}</p>
      <p>Eszközaliasok: {(agent.devices || []).map(d => `${d.alias} (${d.id})`).join(', ') || 'nincsenek megadva'}</p>
      <Button variant="secondary" onClick={() => edit(index)} disabled={!!draft || busy}>Szerkesztés</Button>{' '}
      <Button variant="destructive" disabled={!!draft || busy} onClick={() => { if (window.confirm(`Eltávolítod a(z) ${agent.alias} agentet? A már tárolt adatai megmaradnak.`)) { setSetup({ ...setup, relay: { ...setup.relay, agents: setup.relay.agents.filter((_, i) => i !== index) } }); setDirty(true); } }}>Eltávolítás</Button>
    </div>)}</div>
    {draft && <section style={card}>
      <h2>{selected === null ? 'Új agent' : 'Agent szerkesztése'}</h2>
      <div style={row}>
        <Field label="Agent alias" description="Meglévő agent azonosítója nem módosítható."><Input value={draft.alias} disabled={selected !== null} onChange={e => setDraft({ ...draft, alias: e.currentTarget.value })} /></Field>
        <Field label="MTConnect alap URL"><Input width={45} placeholder="http://agent:5000" value={draft.url} onChange={e => setDraft({ ...draft, url: e.currentTarget.value })} /></Field>
        <Button onClick={probe} disabled={busy || !draft.url}>Kapcsolat ellenőrzése</Button>
      </div>
      <div style={row}><Field label="Megőrzési idő" description="Pl. 1week, 30days. Az üres érték az örökölt beállítást használja."><Input value={draft.retention || ''} onChange={e => setDraft({ ...draft, retention: e.currentTarget.value })} /></Field><Field label="Agent engedélyezve"><Switch value={!draft.ignore} onChange={e => setDraft({ ...draft, ignore: !e.currentTarget.checked })} /></Field></div>
      <Alert title="Eszközaliasok" severity="info">A gyári relay az agent összes eszközét olvassa. Az alábbi lista az elnevezéseket kezeli; egy sor törlése nem kapcsolja ki az adott eszköz adatgyűjtését. Meglévő eszköz azonosítója és aliasa az adatok folytonossága érdekében rögzített.</Alert>
      {found.length > 0 && <div style={card}>{found.map(device => <div key={device.id} style={{ marginBottom: 8 }}><span>{device.name || device.id} · {device.id} </span><Button size="sm" variant="secondary" disabled={(draft.devices || []).some(d => d.id === device.id)} onClick={() => setDraft({ ...draft, devices: [...(draft.devices || []), { id: device.id, alias: (device.name || device.id).replace(/[^\p{L}\p{N}_. -]/gu, '_').slice(0, 64) }] })}>Alias hozzáadása</Button></div>)}</div>}
      {(draft.devices || []).map((device, i) => {
        const existing = selected !== null && (setup.relay.agents[selected].devices || []).some(d => d.id === device.id);
        return <div style={row} key={i}><Field label="MTConnect eszköz ID"><Input value={device.id} disabled={existing} onChange={e => setDraft({ ...draft, devices: draft.devices.map((d, j) => j === i ? { ...d, id: e.currentTarget.value } : d) })} /></Field><Field label="Eszköz alias"><Input value={device.alias} disabled={existing} onChange={e => setDraft({ ...draft, devices: draft.devices.map((d, j) => j === i ? { ...d, alias: e.currentTarget.value } : d) })} /></Field><Button variant="secondary" onClick={() => setDraft({ ...draft, devices: draft.devices.filter((_, j) => i !== j) })}>Alias eltávolítása</Button></div>;
      })}
      <div style={row}><Button variant="secondary" onClick={() => setDraft({ ...draft, devices: [...(draft.devices || []), { id: '', alias: '' }] })}>Eszközalias kézi hozzáadása</Button><Button onClick={keepDraft} disabled={busy}>Módosítások átvétele</Button><Button variant="secondary" onClick={() => setDraft(undefined)}>Mégse</Button></div>
    </section>}
    <details><summary>Mentett YAML-konfiguráció</summary><pre style={{ whiteSpace: 'pre-wrap', marginTop: 12 }}>{snapshot?.yaml}</pre></details>
  </PluginPage>;
}
