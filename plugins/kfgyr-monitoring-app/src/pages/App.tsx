import React, { useEffect, useState } from 'react';
import { getBackendSrv, PluginPage } from '@grafana/runtime';
import {
  Alert,
  Badge,
  Button,
  ConfirmModal,
  Field,
  Icon,
  Input,
  Modal,
  Combobox,
  Spinner,
  useStyles2,
} from '@grafana/ui';
import { lastValueFrom } from 'rxjs';
import { AgentEditor } from '../components/AgentEditor';
import { getStyles } from '../components/styles';
import { Agent, clone, errorText, FoundDevice, retentionLabel, RunnerStatus, Setup, Snapshot } from '../types';

const root = '/api/plugins/kfgyr-monitoring-app/resources';
const pageNav = { text: 'Agentek és gépek', description: 'MTConnect kapcsolatok és eszköznevek kezelése.' };
async function api<T>(path: string, method = 'GET', data?: unknown): Promise<T> {
  const result = await lastValueFrom(getBackendSrv().fetch<T>({ url: `${root}/${path}`, method, data }));
  return result.data;
}
type Confirmation = 'save' | 'discard' | 'rollback' | { remove: number };
const stateLabels: Record<string, string> = {
  starting: 'Indul',
  applying: 'Alkalmazás folyamatban',
  running: 'Relay fut',
  failed: 'Beavatkozás szükséges',
  stopped: 'Leállítva',
  waiting: 'Konfigurációra vár',
  restarting: 'Újraindul',
  unavailable: 'Állapot nem érhető el',
};

export function App() {
  const s = useStyles2(getStyles);
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [setup, setSetup] = useState<Setup>();
  const [status, setStatus] = useState<RunnerStatus>({});
  const [editor, setEditor] = useState<{ index: number | null; initial: Agent }>();
  const [editorDirty, setEditorDirty] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [client, setClient] = useState<Setup['client']>();
  const [settingsSubmitted, setSettingsSubmitted] = useState(false);
  const [settingsClosing, setSettingsClosing] = useState(false);
  const dirty = !!setup && !!snapshot && JSON.stringify(setup) !== JSON.stringify(snapshot.config);
  const settingsDirty = !!client && JSON.stringify(client) !== JSON.stringify(setup?.client);
  const unsaved = dirty || editorDirty || (settingsOpen && settingsDirty);

  async function load() {
    const next = await api<Snapshot>('config');
    setSnapshot(next);
    setSetup(clone(next.config));
    setError('');
    setNotice('');
  }
  useEffect(() => {
    let active = true;
    api<Snapshot>('config')
      .then((next) => {
        if (active) {
          setSnapshot(next);
          setSetup(clone(next.config));
        }
      })
      .catch((e) => {
        if (active) {
          setError(errorText(e));
        }
      });
    const poll = async () => {
      try {
        const next = await api<RunnerStatus>('status');
        if (active) {
          setStatus(next);
        }
      } catch {
        if (active) {
          setStatus((previous) => ({ ...previous, state: 'unavailable' }));
        }
      }
    };
    void poll();
    const timer = setInterval(poll, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    if (!unsaved) {
      return;
    }
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsaved]);

  function edit(index: number | null) {
    if (!setup) {
      return;
    }
    setEditorDirty(false);
    setEditor({
      index,
      initial:
        index === null ? { alias: '', url: '', retention: '1week', devices: [] } : clone(setup.relay.agents[index]),
    });
  }
  function closeEditor() {
    setEditor(undefined);
    setEditorDirty(false);
  }
  function applyAgent(agent: Agent) {
    if (!setup || !editor) {
      return;
    }
    const agents = [...setup.relay.agents];
    if (editor.index === null) {
      agents.push(agent);
    } else {
      agents[editor.index] = agent;
    }
    setSetup({ ...setup, relay: { ...setup.relay, agents } });
    closeEditor();
    setError('');
    setNotice('');
  }
  async function save() {
    if (!snapshot || !setup) {
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const next = await api<Snapshot>('config', 'PUT', { base_revision: snapshot.revision, config: setup });
      setSnapshot(next);
      setSetup(clone(next.config));
      setNotice(
        'A konfiguráció mentve. A relay most alkalmazza a változtatásokat; az állapotjelzés hamarosan frissül.'
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
      setConfirmation(undefined);
    }
  }
  async function rollback() {
    if (!snapshot || !status.revision) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      const next = await api<Snapshot>('rollback', 'POST', {
        base_revision: snapshot.revision,
        revision: status.revision,
      });
      setSnapshot(next);
      setSetup(clone(next.config));
      setNotice('A futó konfiguráció visszaállítása mentve.');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
      setConfirmation(undefined);
    }
  }
  async function reload() {
    setBusy(true);
    try {
      await load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
      setConfirmation(undefined);
    }
  }

  if (!setup || !snapshot) {
    return (
      <PluginPage pageNav={pageNav}>
        <div className={s.page}>
          {error ? (
            <Alert title="Nem sikerült betölteni a konfigurációt" severity="error">
              {error}
              <p>
                <Button variant="secondary" onClick={reload} disabled={busy}>
                  Újrapróbálás
                </Button>
              </p>
            </Alert>
          ) : (
            <div className={s.empty}>
              <Spinner />
              <h3>Agentek betöltése…</h3>
            </div>
          )}
        </div>
      </PluginPage>
    );
  }

  const agents = setup.relay.agents;
  const savedAgents = snapshot.config.relay.agents;
  const added = agents.filter((a) => !savedAgents.some((old) => old.alias === a.alias));
  const removed = savedAgents.filter((a) => !agents.some((next) => next.alias === a.alias));
  const modified = agents.filter((a) => {
    const old = savedAgents.find((saved) => saved.alias === a.alias);
    return old && JSON.stringify(old) !== JSON.stringify(a);
  });
  const clientChanged = JSON.stringify(setup.client) !== JSON.stringify(snapshot.config.client);
  const changeSummary = [
    added.length ? `${added.length} új agent` : '',
    modified.length ? `${modified.length} módosított agent` : '',
    removed.length ? `${removed.length} eltávolított agent` : '',
    clientChanged ? 'Monitoringbeállítások módosítva' : '',
  ].filter(Boolean);
  const visible = agents
    .map((agent, index) => ({ agent, index }))
    .filter(({ agent }) => {
      const text = [agent.alias, agent.url, ...(agent.devices || []).flatMap((d) => [d.alias, d.id])]
        .join(' ')
        .toLocaleLowerCase('hu');
      return (
        text.includes(query.toLocaleLowerCase('hu').trim()) &&
        (filter === 'all' || (filter === 'enabled' ? !agent.ignore : !!agent.ignore))
      );
    });
  const rejected = !!status.failed_revision && status.failed_revision === snapshot.revision;
  const pending = !rejected && status.state === 'running' && status.revision !== snapshot.revision;
  const healthy = status.state === 'running' && !pending && !rejected;
  const statusLabel = rejected
    ? 'Sikertelen alkalmazás'
    : pending
      ? 'Mentett módosítások alkalmazása'
      : stateLabels[status.state || ''] || 'Állapot lekérdezése…';
  const retentionChanged = modified.some(
    (a) => savedAgents.find((old) => old.alias === a.alias)?.retention !== a.retention
  );
  let timezoneError = '';
  try {
    if (!client?.timezone) {
      throw new Error();
    }
    new Intl.DateTimeFormat('hu', { timeZone: client.timezone });
  } catch {
    timezoneError = 'Érvényes időzóna szükséges, például Europe/Budapest.';
  }

  return (
    <PluginPage
      pageNav={pageNav}
      actions={
        <Button
          variant="secondary"
          icon="cog"
          disabled={busy}
          onClick={() => {
            setClient(clone(setup.client));
            setSettingsSubmitted(false);
            setSettingsClosing(false);
            setSettingsOpen(true);
          }}
        >
          Monitoring beállításai
        </Button>
      }
    >
      <div className={s.page}>
        <section className={s.status} aria-label="Monitoring áttekintése">
          <div>
            <div className={s.statusTitle}>
              <Badge
                color={
                  healthy ? 'green' : status.state === 'failed' || status.state === 'unavailable' ? 'red' : 'orange'
                }
                icon={healthy ? 'check-circle' : 'info-circle'}
                text={statusLabel}
              />
              <span>{snapshot.config.client.name}</span>
            </div>
            <div className={s.muted}>
              {healthy
                ? 'A mentett konfiguráció fut. Az adatbeérkezés a dashboardon ellenőrizhető.'
                : status.message || 'A relay állapotának ellenőrzése folyamatban.'}
            </div>
          </div>
          <div className={s.metrics}>
            <span>
              <strong>{agents.length}</strong>agent
            </span>
            <span>
              <strong>{agents.filter((a) => !a.ignore).length}</strong>engedélyezett
            </span>
            <span>
              <strong>{agents.reduce((sum, a) => sum + (a.devices?.length || 0), 0)}</strong>eszköznév
            </span>
          </div>
        </section>
        {error && (
          <Alert title="A módosítás nem sikerült" severity="error" onRemove={() => setError('')}>
            {error}
          </Alert>
        )}
        {notice && (
          <Alert title="Konfiguráció mentve" severity="success" onRemove={() => setNotice('')}>
            {notice}
          </Alert>
        )}
        {rejected && (
          <Alert title="A relay nem tudta alkalmazni az egyik konfigurációt" severity="warning">
            <p>
              A korábbi működő konfiguráció futhat. A részletek és a verziók az alábbi technikai állapotban láthatók.
            </p>
            {status.revision && status.revision !== snapshot.revision && (
              <Button variant="secondary" disabled={busy || dirty} onClick={() => setConfirmation('rollback')}>
                Visszaállítás a futó konfigurációra
              </Button>
            )}
            {dirty && <p>Visszaállítás előtt mentsd vagy vesd el a helyi módosításokat.</p>}
          </Alert>
        )}

        <div className={s.toolbar}>
          <div className={s.search}>
            <Input
              aria-label="Agentek és eszközök keresése"
              placeholder="Keresés név, cím vagy eszköz alapján…"
              prefix={<Icon name="search" />}
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
            />
          </div>
          <div className={s.actions}>
            <label className={s.muted} htmlFor="agent-filter">
              Megjelenítés
            </label>
            <div style={{ width: 180 }}>
              <Combobox
                id="agent-filter"
                value={filter}
                options={[
                  { label: 'Minden agent', value: 'all' },
                  { label: 'Engedélyezett', value: 'enabled' },
                  { label: 'Szüneteltetett', value: 'paused' },
                ]}
                onChange={(option) => setFilter(option.value || 'all')}
              />
            </div>
            <Button
              variant="secondary"
              icon="sync"
              aria-label="Konfiguráció újratöltése"
              title="Konfiguráció újratöltése"
              disabled={busy}
              onClick={() => (dirty ? setConfirmation('discard') : void reload())}
            />
            <Button icon="plus" disabled={busy || agents.length >= 100} onClick={() => edit(null)}>
              Agent hozzáadása
            </Button>
          </div>
        </div>
        <div className={s.list}>
          {!visible.length && (
            <div className={s.empty}>
              <Icon name={agents.length ? 'search' : 'exchange-alt'} size="xxl" />
              <h3>{agents.length ? 'Nincs találat' : 'Csatlakoztasd az első MTConnect agentet'}</h3>
              <p>
                {agents.length
                  ? 'Keress másik névre, címre vagy eszközazonosítóra, vagy állítsd vissza a szűrőt.'
                  : 'Add meg az agent címét, ellenőrizd a kapcsolatot, majd állítsd be az eszközök nevét.'}
              </p>
              <Button
                variant="secondary"
                onClick={() => (agents.length ? (setQuery(''), setFilter('all')) : edit(null))}
              >
                {agents.length ? 'Szűrés törlése' : 'Agent hozzáadása'}
              </Button>
            </div>
          )}
          {visible.map(({ agent, index }) => {
            const isAdded = added.includes(agent);
            const isModified = modified.includes(agent);
            return (
              <article key={agent.alias} className={s.agent} aria-label={`${agent.alias} agent`}>
                <div className={s.agentHead}>
                  <div>
                    <div className={s.agentName}>
                      <h3>{agent.alias}</h3>
                      <Badge
                        color={agent.ignore ? 'darkgrey' : 'blue'}
                        text={agent.ignore ? 'Szüneteltetve' : 'Engedélyezve'}
                      />
                      {(isAdded || isModified) && (
                        <Badge color="orange" text={isAdded ? 'Új · nincs mentve' : 'Módosítva · nincs mentve'} />
                      )}
                    </div>
                    <div className={s.agentUrl}>{agent.url}</div>
                  </div>
                  <div className={s.actions}>
                    <Button variant="secondary" icon="pen" onClick={() => edit(index)} disabled={busy}>
                      Szerkesztés
                    </Button>
                    <Button
                      variant="secondary"
                      icon="trash-alt"
                      aria-label={`${agent.alias} agent eltávolítása`}
                      disabled={busy}
                      onClick={() => setConfirmation({ remove: index })}
                    />
                  </div>
                </div>
                <div className={s.agentBody}>
                  <div className={s.chips}>
                    {(agent.devices || []).map((device) => (
                      <div className={s.chip} key={device.id}>
                        <Icon name="monitor" />
                        {device.alias}
                        <span>{device.id}</span>
                      </div>
                    ))}
                    {!agent.devices?.length && (
                      <span className={s.muted}>Az agent eszközei saját MTConnect nevükön szerepelnek.</span>
                    )}
                  </div>
                  <span className={s.muted}>Megőrzés: {retentionLabel(agent.retention)}</span>
                </div>
              </article>
            );
          })}
        </div>
        {dirty && (
          <aside className={s.savebar} aria-label="Nem mentett módosítások">
            <div>
              <strong>Nem mentett módosítások</strong>
              <div className={s.muted}>{changeSummary.join(' · ')}</div>
            </div>
            <div className={s.actions}>
              <Button variant="secondary" disabled={busy} onClick={() => setConfirmation('discard')}>
                Elvetés
              </Button>
              <Button icon={busy ? 'sync' : 'save'} disabled={busy} onClick={() => setConfirmation('save')}>
                {busy ? 'Mentés…' : 'Mentés és alkalmazás'}
              </Button>
            </div>
          </aside>
        )}
        <details className={s.details}>
          <summary>Technikai állapot és mentett konfiguráció</summary>
          <dl>
            <dt>Mentett verzió</dt>
            <dd>{snapshot.revision}</dd>
            <dt>Futó verzió</dt>
            <dd>{status.revision || '—'}</dd>
            <dt>Utolsó állapotjelzés</dt>
            <dd>{status.updated_at ? new Date(status.updated_at).toLocaleString('hu-HU') : '—'}</dd>
            {status.failed_revision && (
              <>
                <dt>Sikertelen verzió</dt>
                <dd>{status.failed_revision}</dd>
              </>
            )}
          </dl>
          <p className={s.note}>
            Az alábbi YAML az utolsó mentett verzió. A még nem mentett szerkesztéseket nem tartalmazza.
          </p>
          <pre>{snapshot.yaml}</pre>
        </details>

        {editor && (
          <AgentEditor
            initial={editor.initial}
            isNew={editor.index === null}
            existing={savedAgents.find((a) => a.alias === editor.initial.alias)}
            otherAliases={agents.filter((_, i) => i !== editor.index).map((a) => a.alias)}
            onClose={closeEditor}
            onApply={applyAgent}
            onDirty={setEditorDirty}
            probe={(url) => api<{ devices: FoundDevice[] }>('probe', 'POST', { url })}
          />
        )}

        {settingsOpen && client && (
          <Modal
            title="Monitoring beállításai"
            isOpen
            className={s.modal}
            closeOnBackdropClick={false}
            onDismiss={() => (settingsDirty ? setSettingsClosing(true) : setSettingsOpen(false))}
          >
            <form
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                setSettingsSubmitted(true);
                if (!client.name.trim() || timezoneError) {
                  return;
                }
                setSetup({ ...setup, client: { ...client, name: client.name.trim() } });
                setSettingsOpen(false);
              }}
            >
              {settingsClosing && (
                <Alert title="Elveted a beállítások módosításait?" severity="warning">
                  <div className={s.actions}>
                    <Button type="button" variant="secondary" onClick={() => setSettingsClosing(false)}>
                      Szerkesztés folytatása
                    </Button>
                    <Button type="button" variant="destructive" onClick={() => setSettingsOpen(false)}>
                      Űrlap elvetése
                    </Button>
                  </div>
                </Alert>
              )}
              <Field
                label="Monitoring neve"
                htmlFor="client-name"
                description="A relay kliensének neve; az áttekintésben is ez jelenik meg."
                invalid={settingsSubmitted && !client.name.trim()}
                error={settingsSubmitted && !client.name.trim() ? 'Adj nevet a monitoringnak.' : undefined}
              >
                <Input
                  id="client-name"
                  autoFocus
                  value={client.name}
                  onChange={(e) => setClient({ ...client, name: e.currentTarget.value })}
                />
              </Field>
              <Field
                label="Időzóna"
                htmlFor="client-timezone"
                description="Például Europe/Budapest vagy UTC."
                invalid={settingsSubmitted && !!timezoneError}
                error={settingsSubmitted ? timezoneError : undefined}
              >
                <Input
                  id="client-timezone"
                  value={client.timezone}
                  onChange={(e) => setClient({ ...client, timezone: e.currentTarget.value })}
                />
              </Field>
              <p className={s.note}>A változtatásokat a főoldali „Mentés és alkalmazás” gombbal élesítheted.</p>
              <div className={s.footer}>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => (settingsDirty ? setSettingsClosing(true) : setSettingsOpen(false))}
                >
                  Mégse
                </Button>
                <Button type="submit">Módosítások átvétele</Button>
              </div>
            </form>
          </Modal>
        )}

        {confirmation === 'save' && (
          <ConfirmModal
            isOpen
            title="Módosítások mentése és alkalmazása"
            confirmText="Mentés és alkalmazás"
            dismissText="Vissza a szerkesztéshez"
            confirmVariant="primary"
            body={
              <div>
                <p>Az alábbi változtatások lépnek életbe:</p>
                <ul>
                  {changeSummary.map((change) => (
                    <li key={change}>{change}</li>
                  ))}
                </ul>
                <p>A relay újraindul, az adatgyűjtés rövid időre megszakad.</p>
                {retentionChanged && (
                  <Alert title="Megőrzési idő változik" severity="warning">
                    A rövidebb megőrzési idő a már tárolt, régebbi adatok törlését is okozhatja.
                  </Alert>
                )}
              </div>
            }
            onConfirm={save}
            onDismiss={() => setConfirmation(undefined)}
            disabled={busy}
          />
        )}
        {confirmation === 'discard' && (
          <ConfirmModal
            isOpen
            title="Elveted a nem mentett módosításokat?"
            confirmText="Módosítások elvetése"
            dismissText="Szerkesztés folytatása"
            body="A legutóbb mentett konfiguráció töltődik be. A jelenlegi, még nem mentett szerkesztéseid elvesznek."
            onConfirm={reload}
            onDismiss={() => setConfirmation(undefined)}
            disabled={busy}
          />
        )}
        {confirmation === 'rollback' && (
          <ConfirmModal
            isOpen
            title="Visszaállítás a futó konfigurációra"
            confirmText="Visszaállítás"
            dismissText="Mégse"
            body="A runner által jelenleg használt konfigurációt mentjük vissza. A sikertelen verzióban lévő változtatásokat később újra megadhatod."
            onConfirm={rollback}
            onDismiss={() => setConfirmation(undefined)}
            disabled={busy}
          />
        )}
        {typeof confirmation === 'object' && (
          <ConfirmModal
            isOpen
            title={`${agents[confirmation.remove].alias} eltávolítása`}
            confirmText="Eltávolítás a listából"
            dismissText="Mégse"
            body="Az agent a mentés és alkalmazás után leáll az adatgyűjtéssel. A korábban tárolt adatok megmaradnak, és a megőrzési szabályok továbbra is érvényesek."
            onConfirm={() => {
              setSetup({
                ...setup,
                relay: { ...setup.relay, agents: agents.filter((_, i) => i !== confirmation.remove) },
              });
              setConfirmation(undefined);
            }}
            onDismiss={() => setConfirmation(undefined)}
          />
        )}
      </div>
    </PluginPage>
  );
}
