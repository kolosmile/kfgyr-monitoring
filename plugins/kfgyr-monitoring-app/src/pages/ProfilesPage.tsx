import React, { useEffect, useState } from 'react';
import { HomeLink } from '../components/HomeLink';
import { PluginPage, config } from '@grafana/runtime';
import { Alert, Button, Combobox, ConfirmModal, Field, Icon, Input, LinkButton, Modal, Spinner, useStyles2 } from '@grafana/ui';
import { api } from '../api';
import { getStyles } from '../components/styles';
import { errorText } from '../types';
import { menu } from '../navigation/menu';

type View = 'value' | 'state' | 'chart' | 'gauge';
type ChartColor = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'yellow';
const chartColors: Array<{ value: ChartColor; label: string }> = [
  { value: 'blue', label: 'Kék' },
  { value: 'green', label: 'Zöld' },
  { value: 'orange', label: 'Narancs' },
  { value: 'red', label: 'Piros' },
  { value: 'purple', label: 'Lila' },
  { value: 'yellow', label: 'Sárga' },
];
type Panel = { name?: string; signal_id?: string; point?: string; view: View; minimum?: number; maximum?: number; color?: ChartColor };
type Option = { id: string; label: string; schema_id?: string };
type SignalPreset = { label: string; signals: string[] };
type Catalog = { presets: SignalPreset[]; machines: Option[] };
type Dashboard = { id: number; name: string; revision: number; is_default: boolean };
type PanelOption = { kind: 'signal' | 'point'; id: string; label: string; units?: string };
type Assignment = { id: number; name: string; panels: Panel[]; revision: number; options: PanelOption[] };

const views: Array<{ value: View; label: string }> = [
  { value: 'state', label: 'Állapot' },
  { value: 'value', label: 'Aktuális érték' },
  { value: 'gauge', label: 'Műszer' },
  { value: 'chart', label: 'Grafikon' },
];

export function ProfilesPage() {
  const styles = useStyles2(getStyles);
  const [catalog, setCatalog] = useState<Catalog>();
  const [machine, setMachine] = useState('');
  const [assignment, setAssignment] = useState<Assignment>();
  const [dashboards, setDashboards] = useState<Dashboard[]>();
  const [listRevision, setListRevision] = useState(0);
  const [dashboardId, setDashboardId] = useState<number>();
  const [dashboardName, setDashboardName] = useState('');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [preset, setPreset] = useState<number>();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editor, setEditor] = useState<{ index: number | null; panel: Panel }>();
  const [editorError, setEditorError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedPanels, setSavedPanels] = useState('');
  const [confirmBack, setConfirmBack] = useState(false);
  const dirty = !!assignment && JSON.stringify({ panels: assignment.panels, name: dashboardName }) !== savedPanels;

  useEffect(() => {
    api<Catalog>('machines').then(setCatalog).catch((err) => setError(errorText(err)));
  }, []);

  useEffect(() => {
    if (!machine) {
      return;
    }
    let active = true;
    api<{ dashboards: Dashboard[] }>(`machines/${encodeURIComponent(machine)}/dashboards`)
      .then((value) => active && setDashboards(value.dashboards))
      .catch((err) => active && setError(errorText(err)));
    return () => { active = false; };
  }, [machine, listRevision]);

  useEffect(() => {
    if (dashboardId === undefined) {
      return;
    }
    let active = true;
    setAssignment(undefined);
    api<Assignment>(`dashboards/${dashboardId}`)
      .then((value) => {
        if (active) {
          setAssignment(value);
          setDashboardName(value.name);
          setSavedPanels(JSON.stringify({ panels: value.panels, name: value.name }));
        }
      })
      .catch((err) => active && setError(errorText(err)));
    return () => { active = false; };
  }, [dashboardId]);

  useEffect(() => {
    if (!dirty) {
      return;
    }
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function backToMachines() {
    setMachine('');
    setDashboardId(undefined);
    setDashboards(undefined);
    setSearch('');
    setAssignment(undefined);
    setSavedPanels('');
    setEditor(undefined);
    setEditorError('');
    setPreset(undefined);
    setError('');
    setNotice('');
    setConfirmBack(false);
  }

  function backToDashboards() {
    setDashboardId(undefined);
    setAssignment(undefined);
    setSavedPanels('');
    setEditor(undefined);
    setPreset(undefined);
    setError('');
    setNotice('');
    setConfirmBack(false);
    setListRevision((revision) => revision + 1);
  }

  async function createDashboard() {
    if (!dashboardName.trim() || saving) {
      return;
    }
    setSaving(true);
    setError('');
    try {
      const result = await api<{ id: number }>('dashboards', 'POST', { machine, name: dashboardName.trim() });
      setCreating(false);
      setDashboardId(result.id);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  async function deleteDashboard() {
    if (!assignment || saving) {
      return;
    }
    setSaving(true);
    try {
      await api('dashboards/delete', 'POST', { id: assignment.id, revision: assignment.revision });
      setConfirmDelete(false);
      backToDashboards();
    } catch (err) {
      setConfirmDelete(false);
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  function changePanels(panels: Panel[]) {
    setAssignment((current) => current && { ...current, panels });
    setNotice('');
  }

  function editPanel(index: number | null) {
    if (!assignment) {
      return;
    }
    setEditorError('');
    setEditor({
      index,
      panel: index === null ? { view: 'chart' } : { ...assignment.panels[index] },
    });
  }

  function applyPanel() {
    if (!editor || !assignment) {
      return;
    }
    const panel = { ...editor.panel, name: editor.panel.name?.trim() || undefined };
    if (!(panel.signal_id || panel.point)) {
      setEditorError('Válassz jelet a katalógusból.');
      return;
    }
    if (panel.view === 'gauge' &&
      (!Number.isFinite(panel.minimum) || !Number.isFinite(panel.maximum) || !(panel.minimum! < panel.maximum!))) {
      setEditorError('A műszer maximuma legyen nagyobb a minimumnál.');
      return;
    }
    const panels = [...assignment.panels];
    if (editor.index === null) {
      panels.push(panel);
    } else {
      panels[editor.index] = panel;
    }
    changePanels(panels);
    setEditor(undefined);
    setEditorError('');
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!assignment || saving) {
      return;
    }
    setError('');
    setNotice('');
    const { panels, revision } = assignment;
    if (!dashboardName.trim()) {
      setError('Adj nevet a dashboardnak.');
      return;
    }
    const invalidIndex = panels.findIndex((panel) => !(panel.signal_id || panel.point) ||
      (panel.view === 'gauge' &&
        (!Number.isFinite(panel.minimum) || !Number.isFinite(panel.maximum) || !(panel.minimum! < panel.maximum!))));
    if (invalidIndex !== -1) {
      editPanel(invalidIndex);
      setError('Válassz jelet minden panelhez. A műszer maximuma pedig legyen nagyobb a minimumnál.');
      return;
    }
    setSaving(true);
    try {
      const result = await api<{ revision: number }>('dashboards', 'PUT', { id: assignment.id, name: dashboardName.trim(), panels, revision });
      setAssignment({ ...assignment, revision: result.revision });
      setDashboardName(dashboardName.trim());
      setSavedPanels(JSON.stringify({ panels, name: dashboardName.trim() }));
      setNotice('A monitoring beállításai mentve.');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  const points = assignment?.options ?? [];
  const panelOption = (panel: Panel) => points.find((item) =>
    (panel.signal_id && item.kind === 'signal' && item.id === panel.signal_id) ||
    (panel.point && item.kind === 'point' && item.id === panel.point));
  const panelName = (panel: Panel) => panel.name || panelOption(panel)?.label || 'Névtelen panel';
  const groups = new Map<string, Option[]>();
  for (const item of catalog?.machines ?? []) {
    const separator = item.label.indexOf('/');
    const agent = separator < 0 ? 'Egyéb' : item.label.slice(0, separator);
    groups.set(agent, [...(groups.get(agent) || []), item]);
  }
  const selected = catalog?.machines.find((item) => item.id === machine);
  return (
    <PluginPage pageNav={menu.dashboard} actions={(
      <div className={styles.actions}>
        <LinkButton href={config.appSubUrl + menu.schemas.path} variant="secondary" icon={menu.schemas.icon}>
          {menu.schemas.text}
        </LinkButton>
        <HomeLink />
      </div>
    )}>
      <div className={styles.page}>
        <form onSubmit={save} className={styles.form}>
          {error && <Alert severity="error" title="A művelet sikertelen">{error}</Alert>}
          {notice && <Alert severity="success" title={notice} />}
          {!machine && (
            <>
              {!catalog && !error && <div role="status"><Spinner /> Gépek betöltése…</div>}
              {catalog && !catalog.machines.length && (
                <div className={styles.empty}>
                  <h3>Még nincs beolvasott gép</h3>
                  <p>Az Agentek és gépek oldalon bekötött gépek az első beolvasás után jelennek meg itt.</p>
                </div>
              )}
              {[...groups].map(([agent, machines]) => (
                <section key={agent} className={styles.formCard}>
                  <h3>{agent}</h3>
                  <div className={styles.machineGrid}>
                    {machines.map((item) => (
                      <button key={item.id} type="button" className={styles.machineCard} onClick={() => {
                        setError('');
                        setNotice('');
                        setMachine(item.id);
                      }}>
                        <Icon name="monitor" size="xl" />
                        <span>{item.label.includes('/') ? item.label.slice(item.label.indexOf('/') + 1) : item.label}</span>
                        <Icon name="angle-right" />
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </>
          )}
          {machine && (
            <section className={styles.formCard}>
              <div className={styles.formFooter}>
                <div>
                  <Button type="button" icon="arrow-left" variant="secondary" disabled={saving}
                    onClick={() => dashboardId !== undefined ? (dirty ? setConfirmBack(true) : backToDashboards()) : backToMachines()}>
                    {dashboardId !== undefined ? 'Vissza a dashboardokhoz' : 'Vissza a gépekhez'}
                  </Button>
                </div>
                <strong>{selected?.label}</strong>
              </div>
            </section>
          )}
          {machine && dashboardId === undefined && (
            <section className={styles.formCard}>
              <div className={styles.formFooter}>
                <h3>Dashboardok</h3>
                <Button type="button" icon="plus" disabled={saving} onClick={() => {
                  setDashboardName('');
                  setCreating(true);
                }}>Dashboard hozzáadása</Button>
              </div>
              <Field label="Dashboard keresése" htmlFor="dashboard-search">
                <Input id="dashboard-search" placeholder="Keress név alapján…" value={search}
                  onChange={(event) => setSearch(event.currentTarget.value)} />
              </Field>
              {!dashboards && !error && <div role="status"><Spinner /> Dashboardok betöltése…</div>}
              {dashboards && !dashboards.length && <p className={styles.muted}>Ehhez a géphez még nincs dashboard.</p>}
              {dashboards && dashboards.length > 0 && !dashboards.some((item) =>
                item.name.toLocaleLowerCase('hu').includes(search.trim().toLocaleLowerCase('hu'))) &&
                <p className={styles.muted}>Nincs a keresésnek megfelelő dashboard.</p>}
              <div className={styles.machineGrid}>
                {dashboards?.filter((item) => item.name.toLocaleLowerCase('hu')
                  .includes(search.trim().toLocaleLowerCase('hu'))).map((item) => (
                  <button key={item.id} type="button" className={styles.machineCard} onClick={() => {
                    setError('');
                    setNotice('');
                    setDashboardId(item.id);
                  }}>
                    <Icon name="apps" size="xl" />
                    <span>{item.name}</span>
                    <Icon name="angle-right" />
                  </button>
                ))}
              </div>
            </section>
          )}
          {dashboardId !== undefined && !assignment && !error && <div role="status"><Spinner /> Beállítások betöltése…</div>}
          {assignment && (
            <>
              <section className={styles.formCard}>
                <Field label="Dashboard neve" htmlFor="dashboard-name">
                  <Input id="dashboard-name" maxLength={120} disabled={saving} value={dashboardName}
                    onChange={(event) => setDashboardName(event.currentTarget.value)} />
                </Field>
                <h3>Panelek</h3>
                <p className={styles.note}>Kezdj üres listával, vagy adj hozzá szerkeszthető paneljavaslatokat. A sorrend nézetenként érvényesül.</p>
                <Field label="Panelsablon csomag" htmlFor="panel-preset">
                  <Combobox id="panel-preset" disabled={saving} value={preset ?? null}
                    options={catalog?.presets.map(({ label }, value) => ({ value, label })) ?? []}
                    onChange={({ value }) => setPreset(value)} />
                </Field>
                <div className={styles.actions}>
                  <Button type="button" variant="secondary" disabled={saving || preset === undefined} onClick={() => {
                    const selectedPreset = preset === undefined ? undefined : catalog?.presets[preset];
                    if (selectedPreset) {
                      const available = selectedPreset.signals
                        .filter((signalId) => points.some((item) => item.kind === 'signal' && item.id === signalId))
                        .map((signal_id) => ({ signal_id, view: signal_id === 'execution' ? 'state' as View : 'chart' as View }));
                      const missing = selectedPreset.signals.length - available.length;
                      changePanels([...assignment.panels, ...available]);
                      setNotice(missing
                        ? `${available.length} jel bekerült. ${missing} jelhez ezen a gépen nincs séma-hozzárendelés vagy adatpont.`
                        : 'A panelsablon katalógusjelei bekerültek.');
                      setPreset(undefined);
                    }
                  }}>Javasolt panelek hozzáadása</Button>
                  <Button type="button" icon="plus" disabled={saving}
                    onClick={() => editPanel(null)}>
                    Panel hozzáadása
                  </Button>
                </div>
              </section>
              {views.map(({ value, label }) => {
                const panels = assignment.panels
                  .map((panel, index) => ({ panel, index }))
                  .filter(({ panel }) => panel.view === value);
                if (!panels.length) {
                  return null;
                }
                return (
                  <section key={value}>
                    <h3>{label}</h3>
                    <div className={styles.panelGrid}>
                      {panels.map(({ panel, index }, position) => {
                        const option = panelOption(panel);
                        const label = panelName(panel);
                        const move = (offset: number) => {
                          const target = panels[position + offset]?.index;
                          if (target === undefined) {
                            return;
                          }
                          const next = [...assignment.panels];
                          [next[index], next[target]] = [next[target], next[index]];
                          changePanels(next);
                        };
                        return (
                          <article className={styles.panelCard} key={index}>
                            <strong>{label}</strong>
                            <div className={styles.panelPoint}>
                              {option?.kind === 'signal' ? `Jelkatalógus: ${option.label}` :
                                option?.label || (panel.signal_id ? 'A jelhez ezen a gépen nincs hozzárendelt adatpont' : 'A mentett adatpont nem érhető el')}
                            </div>
                            <div className={styles.actions}>
                              <Button type="button" variant="secondary" icon="arrow-up" disabled={saving || position === 0}
                                aria-label={`${label} előrébb helyezése`} onClick={() => move(-1)} />
                              <Button type="button" variant="secondary" icon="arrow-down" disabled={saving || position === panels.length - 1}
                                aria-label={`${label} hátrébb helyezése`} onClick={() => move(1)} />
                              <Button type="button" variant="secondary" icon="pen" disabled={saving}
                                aria-label={`${label} szerkesztése`} onClick={() => editPanel(index)} />
                              <Button type="button" variant="destructive" icon="trash-alt" disabled={saving}
                                aria-label={`${label} eltávolítása`}
                                onClick={() => changePanels(assignment.panels.filter((_, i) => i !== index))} />
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
              <div className={styles.formFooter}>
                <a href={config.appSubUrl + menu.monitoring.path + '?var-machine=' + encodeURIComponent(machine) + '&var-dashboard=' + assignment.id}>Monitoring megnyitása</a>
                <div className={styles.actions}>
                  <Button type="button" icon="trash-alt" variant="destructive" disabled={saving}
                    onClick={() => setConfirmDelete(true)}>Dashboard törlése</Button>
                  <Button type="submit" icon="save" disabled={saving}>{saving ? 'Mentés…' : 'Dashboard mentése'}</Button>
                </div>
              </div>
            </>
          )}
        </form>
        {creating && (
          <Modal title="Dashboard hozzáadása" isOpen onDismiss={() => setCreating(false)}>
            <Field label="Dashboard neve" htmlFor="new-dashboard-name">
              <Input id="new-dashboard-name" autoFocus maxLength={120} value={dashboardName}
                onChange={(event) => setDashboardName(event.currentTarget.value)} />
            </Field>
            <Modal.ButtonRow>
              <Button type="button" variant="secondary" onClick={() => setCreating(false)}>Mégse</Button>
              <Button type="button" disabled={saving || !dashboardName.trim()} onClick={createDashboard}>Létrehozás</Button>
            </Modal.ButtonRow>
          </Modal>
        )}
        {confirmDelete && (
          <ConfirmModal isOpen title="Dashboard törlése" body="A dashboard panelbeállításai törlődnek."
            confirmText="Dashboard törlése" dismissText="Mégse" confirmVariant="destructive"
            disabled={saving} onConfirm={deleteDashboard} onDismiss={() => setConfirmDelete(false)} />
        )}
        {editor && (
          <Modal title={editor.index === null ? 'Új panel' : 'Panel szerkesztése'} isOpen
            onDismiss={() => setEditor(undefined)}>
            {editorError && <Alert severity="error" title={editorError} />}
            <Field label="Megjelenített név" htmlFor="panel-name">
              <Input id="panel-name" maxLength={120} value={editor.panel.name || ''}
                placeholder={panelOption(editor.panel)?.label || 'A jelkatalógus neve'}
                onChange={(event) => setEditor({ ...editor, panel: { ...editor.panel, name: event.currentTarget.value } })} />
            </Field>
            <Field label="Jel a katalógusból" htmlFor="panel-signal">
              <Combobox id="panel-signal"
                value={editor.panel.signal_id ? `signal:${editor.panel.signal_id}` : editor.panel.point ? `point:${editor.panel.point}` : null}
                placeholder="Válassz jelet"
                options={points.filter((item) => item.kind === 'signal' ||
                  (editor.panel.point && item.kind === 'point' && item.id === editor.panel.point))
                  .map((item) => ({ value: `${item.kind}:${item.id}`, label: item.label }))}
                onChange={({ value }) => {
                  const separator = value.indexOf(':');
                  const kind = value.slice(0, separator);
                  const id = value.slice(separator + 1);
                  setEditor({ ...editor, panel: { ...editor.panel,
                    signal_id: kind === 'signal' ? id : undefined,
                    point: kind === 'point' ? id : undefined,
                  } });
                }} />
            </Field>
            <Field label="Nézet" htmlFor="panel-view">
              <Combobox id="panel-view" value={editor.panel.view} options={views}
                onChange={({ value }) => setEditor({ ...editor, panel: { ...editor.panel, view: value } })} />
            </Field>
            {editor.panel.view === 'chart' && (
              <Field label="Vonalszín" htmlFor="panel-color">
                <Combobox id="panel-color" value={editor.panel.color ?? null} options={chartColors}
                  placeholder="Automatikus" isClearable
                  onChange={(option) => setEditor({ ...editor, panel: { ...editor.panel, color: option?.value } })} />
              </Field>
            )}
            {editor.panel.view === 'gauge' && (
              <div className={styles.grid}>
                {(['minimum', 'maximum'] as const).map((bound) => (
                  <Field key={bound} label={bound === 'minimum' ? 'Minimum' : 'Maximum'} htmlFor={`panel-${bound}`}>
                    <Input id={`panel-${bound}`} type="number" step="any" value={editor.panel[bound] ?? ''}
                      onChange={(event) => setEditor({ ...editor, panel: { ...editor.panel,
                        [bound]: event.currentTarget.value === '' ? undefined : event.currentTarget.valueAsNumber,
                      } })} />
                  </Field>
                ))}
              </div>
            )}
            <Modal.ButtonRow>
              <Button type="button" variant="secondary" onClick={() => setEditor(undefined)}>Mégse</Button>
              <Button type="button" onClick={applyPanel}>Módosítások átvétele</Button>
            </Modal.ButtonRow>
          </Modal>
        )}
        {confirmBack && (
          <ConfirmModal isOpen title="Elveted a nem mentett módosításokat?"
            body="A panelbeállítások módosításai elvesznek, ha visszalépsz mentés nélkül."
            confirmText="Módosítások elvetése" dismissText="Szerkesztés folytatása"
            onConfirm={backToDashboards} onDismiss={() => setConfirmBack(false)} />
        )}
      </div>
    </PluginPage>
  );
}
