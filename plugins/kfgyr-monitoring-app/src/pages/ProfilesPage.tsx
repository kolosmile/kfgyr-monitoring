import React, { useEffect, useState } from 'react';
import type { IconName } from '@grafana/data';
import { HomeLink } from '../components/HomeLink';
import { MenuPageTitle } from '../components/MenuPageTitle';
import { PluginPage, config } from '@grafana/runtime';
import { Alert, Badge, Button, Combobox, ConfirmModal, Field, Icon, IconButton, Input, LinkButton, Modal, Spinner, useStyles2 } from '@grafana/ui';
import { api } from '../api';
import { getStyles } from '../components/styles';
import { errorText } from '../types';
import { menu, signalCatalogIcon } from '../navigation/menu';
import { SchemasPage } from './SchemasPage';

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
type Catalog = { machines: Option[] };
type Dashboard = { id: number; name: string; revision: number; is_default: boolean };
type CopySource = { id: number; name: string; agent: string; machine: string };
type DashboardList = { dashboards: Dashboard[]; copy_sources?: CopySource[] };
type PanelOption = { kind: 'signal' | 'point'; id: string; label: string; units?: string };
type Assignment = { id: number; name: string; panels: Panel[]; revision: number; options: PanelOption[] };

const views: Array<{ value: View; label: string; icon: IconName }> = [
  { value: 'state', label: 'Állapot', icon: 'toggle-on' },
  { value: 'value', label: 'Aktuális érték', icon: 'calculator-alt' },
  { value: 'gauge', label: 'Műszer', icon: 'tachometer-fast' },
  { value: 'chart', label: 'Grafikon', icon: 'chart-line' },
];

function machineLabel(label: string) {
  const separator = label.indexOf('/');
  return separator < 0 ? { agent: '', name: label } : {
    agent: label.slice(0, separator),
    name: label.slice(separator + 1),
  };
}

function initialEditorRoute() {
  const params = new URLSearchParams(window.location.search);
  const dashboard = params.get('dashboard') ?? '';
  const machine = params.get('machine') ?? '';
  const create = !!machine && params.get('create') === '1';
  return {
    machine,
    dashboardId: machine && !create && /^\d+$/.test(dashboard) ? Number(dashboard) : undefined,
    create,
  };
}

function DashboardIcon({ className }: { className: string }) {
  return (
    <svg className={className} aria-hidden="true" width="20" height="20" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="12" width="7" height="10" rx="1" />
      <rect x="14" y="3" width="7" height="10" rx="1" />
      <rect x="14" y="15" width="7" height="7" rx="1" />
    </svg>
  );
}

export function ProfilesPage() {
  const styles = useStyles2(getStyles);
  const [initialRoute] = useState(initialEditorRoute);
  const [catalog, setCatalog] = useState<Catalog>();
  const [machine, setMachine] = useState(initialRoute.machine);
  const [assignment, setAssignment] = useState<Assignment>();
  const [dashboards, setDashboards] = useState<Dashboard[]>();
  const [copySources, setCopySources] = useState<CopySource[]>([]);
  const [listRevision, setListRevision] = useState(0);
  const [dashboardId, setDashboardId] = useState<number | undefined>(initialRoute.dashboardId);
  const [dashboardName, setDashboardName] = useState('');
  const [renameDraft, setRenameDraft] = useState<string>();
  const [showSchemas, setShowSchemas] = useState(false);
  const [openViews, setOpenViews] = useState<Partial<Record<View, boolean>>>({});
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(initialRoute.create);
  const [copySourceId, setCopySourceId] = useState(0);
  const [createError, setCreateError] = useState('');
  const [skippedPanels, setSkippedPanels] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [panelToRemove, setPanelToRemove] = useState<{ index: number; panel: Panel; label: string }>();
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
    api<DashboardList>(`machines/${encodeURIComponent(machine)}/dashboards`)
      .then((value) => {
        if (active) {
          setDashboards(value.dashboards);
          setCopySources(value.copy_sources ?? []);
        }
      })
      .catch((err) => active && setError(errorText(err)));
    return () => { active = false; };
  }, [machine, listRevision]);

  useEffect(() => {
    if (dashboardId === undefined || !dashboards) {
      return;
    }
    if (!dashboards.some(({ id }) => id === dashboardId)) {
      setDashboardId(undefined);
      if (dashboards.length === 0) {
        setCreating(true);
      }
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
  }, [dashboardId, dashboards]);

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
    setCopySources([]);
    setSkippedPanels(0);
    setCreating(false);
    setSearch('');
    setAssignment(undefined);
    setSavedPanels('');
    setEditor(undefined);
    setEditorError('');
    setError('');
    setNotice('');
    setConfirmBack(false);
  }

  function backToDashboards() {
    setDashboardId(undefined);
    setAssignment(undefined);
    setSavedPanels('');
    setEditor(undefined);
    setOpenViews({});
    setSkippedPanels(0);
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
    setCreateError('');
    try {
      const result = await api<{ id: number; skipped_panels: number }>('dashboards', 'POST', {
        machine, name: dashboardName.trim(), ...(copySourceId ? { source_dashboard_id: copySourceId } : {}),
      });
      setSkippedPanels(result.skipped_panels ?? 0);
      setCreating(false);
      setDashboards(undefined);
      setListRevision((revision) => revision + 1);
      setDashboardId(result.id);
    } catch (err) {
      setCreateError(errorText(err));
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

  function removePanel() {
    if (saving || !assignment || !panelToRemove) {
      return;
    }
    const { index, panel } = panelToRemove;
    if (assignment.panels[index] === panel) {
      changePanels(assignment.panels.filter((_, currentIndex) => currentIndex !== index));
    }
    setPanelToRemove(undefined);
  }

  function editPanel(index: number | null, view: View = 'chart') {
    if (!assignment) {
      return;
    }
    setEditorError('');
    setEditor({
      index,
      panel: index === null ? { view } : { ...assignment.panels[index] },
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
    setOpenViews((current) => ({ ...current, [panel.view]: true }));
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
    const agent = machineLabel(item.label).agent || 'Egyéb';
    groups.set(agent, [...(groups.get(agent) || []), item]);
  }
  const selected = catalog?.machines.find((item) => item.id === machine);
  const selectedMachine = selected ? machineLabel(selected.label) : undefined;
  const dashboardQuery = search.trim().toLocaleLowerCase('hu');
  const visibleDashboards = dashboards?.filter((item) => item.name.toLocaleLowerCase('hu').includes(dashboardQuery));

  function returnFromSchemas() {
    setShowSchemas(false);
    if (!assignment) {
      return;
    }
    const { id } = assignment;
    api<Assignment>(`dashboards/${id}`).then(({ options }) => {
      setAssignment((current) => current?.id === id ? { ...current, options } : current);
    }).catch((err) => setError(errorText(err)));
  }

  if (showSchemas) {
    return <SchemasPage onBack={returnFromSchemas} />;
  }

  return (
    <PluginPage pageNav={menu.dashboard} renderTitle={() => null}>
      <div className={styles.page}>
        <MenuPageTitle item={menu.dashboard} />
        <form onSubmit={save} className={styles.form}>
          {error && <Alert severity="error" title="A művelet sikertelen">{error}</Alert>}
          {notice && <Alert severity="success" title={notice} />}
          {skippedPanels > 0 && <Alert severity="warning" title={`${skippedPanels} panel kimaradt a másolásból`}>
            Ezekhez a panelekhez a célgépen nem találtunk megfelelő adatpontot.
          </Alert>}
          {!machine && (
            <>
              <div><HomeLink /></div>
              <h2 className={`${styles.editorSectionTitle} ${styles.machineListTitle}`}>Gépek</h2>
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
                        <span>{machineLabel(item.label).name}</span>
                        <Icon name="angle-right" />
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </>
          )}
          {machine && (
            <header className={styles.editorHeader}>
              <div className={styles.editorColumns}>
                <div className={styles.editorNavigation}>
                  <HomeLink />
                  <Button type="button" icon="arrow-left" variant="secondary" disabled={saving}
                    onClick={() => dashboardId !== undefined ? (dirty ? setConfirmBack(true) : backToDashboards()) : backToMachines()}>
                    {dashboardId !== undefined ? 'Vissza a dashboardokhoz' : 'Vissza a gépekhez'}
                  </Button>
                </div>
                <div className={styles.editorHeaderRight}>
                  {assignment ? (
                    <Button type="button" variant="secondary" icon={menu.schemas.icon} disabled={saving} onClick={() => setShowSchemas(true)}>
                      {menu.schemas.text}
                    </Button>
                  ) : (
                    <LinkButton href={config.appSubUrl + menu.schemas.path} variant="secondary" icon={menu.schemas.icon}>
                      {menu.schemas.text}
                    </LinkButton>
                  )}
                  <div className={styles.editorHeading}>
                    <div className={styles.editorTitleRow}>
                      <h2 className={styles.editorTitle}>{assignment ? dashboardName : selectedMachine?.name}</h2>
                      {assignment && <IconButton type="button" name="pen" tooltip="Dashboard átnevezése" disabled={saving}
                        onClick={() => setRenameDraft(dashboardName)} />}
                    </div>
                    <div className={styles.actions}>
                      {assignment && selectedMachine && <span className={styles.muted}>{selectedMachine.name}</span>}
                      {selectedMachine?.agent && <Badge color="blue" text={selectedMachine.agent} />}
                    </div>
                  </div>
                </div>
              </div>
            </header>
          )}
          {machine && dashboardId === undefined && (
            <>
              <h3 className={styles.editorSectionTitle}>Dashboardok</h3>
              <section className={styles.formCard}>
                <div className={styles.formFooter}>
                  <div className={styles.dashboardSearch}>
                    <Input aria-label="Dashboard keresése" placeholder="Dashboard keresése…"
                      prefix={<Icon name="search" />} value={search}
                      onChange={(event) => setSearch(event.currentTarget.value)} />
                  </div>
                  <Button type="button" icon="plus" disabled={saving} onClick={() => {
                    setDashboardName('');
                    setCopySourceId(0);
                    setCreateError('');
                    setCreating(true);
                  }}>Dashboard hozzáadása</Button>
                </div>
                {!dashboards && !error && <div role="status"><Spinner /> Dashboardok betöltése…</div>}
                {dashboards && !dashboards.length && <p className={styles.muted}>Ehhez a géphez még nincs dashboard.</p>}
                {dashboards && dashboards.length > 0 && !visibleDashboards?.length &&
                  <p className={styles.muted}>Nincs a keresésnek megfelelő dashboard.</p>}
                <div className={styles.dashboardGrid}>
                  {visibleDashboards?.map((item) => (
                    <button key={item.id} type="button" className={styles.machineCard} onClick={() => {
                      setError('');
                      setNotice('');
                      setDashboardId(item.id);
                    }}>
                      <DashboardIcon className={styles.dashboardIcon} />
                      <span>{item.name}</span>
                      <Icon name="angle-right" />
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}
          {dashboardId !== undefined && !assignment && !error && <div role="status"><Spinner /> Beállítások betöltése…</div>}
          {assignment && (
            <>
              <h3 className={styles.editorSectionTitle}>Panelszerkesztő</h3>
              <div className={styles.panelGroups}>
                {views.map(({ value, label, icon }) => {
                  const panels = assignment.panels
                    .map((panel, index) => ({ panel, index }))
                    .filter(({ panel }) => panel.view === value);
                  const isOpen = openViews[value] ?? false;
                  return (
                    <details key={value} className={`${styles.panelGroup} ${styles.panelAccents[value]}`}
                      open={isOpen}
                      onToggle={(event) => {
                        const open = event.currentTarget.open;
                        if (open !== isOpen) {
                          setOpenViews((current) => ({ ...current, [value]: open }));
                        }
                      }}>
                      <summary className={styles.panelGroupTitle}>
                        <Icon name={icon} aria-hidden />{label}<Icon name="angle-right" aria-hidden />
                      </summary>
                      <div className={styles.panelGrid}>
                        {panels.map(({ panel, index }, position) => {
                          const option = panelOption(panel);
                          const label = panelName(panel);
                          const pointLabel = option?.label || (panel.signal_id ? 'Nincs hozzárendelt adatpont' : 'A mentett adatpont nem érhető el');
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
                              <strong className={styles.panelTitle}>
                                <Icon name={icon} aria-hidden />
                                <span className={styles.panelText} title={label}>{label}</span>
                              </strong>
                              <div className={styles.panelEdit}>
                                <IconButton type="button" name="pen" disabled={saving}
                                  tooltip={`${label} szerkesztése`} onClick={() => editPanel(index)} />
                              </div>
                              <div className={styles.panelPoint}>
                                {panel.signal_id && <Icon name={signalCatalogIcon} aria-label="Jelkatalógus" />}
                                <span className={styles.panelText} title={pointLabel}>{pointLabel}</span>
                              </div>
                              <div className={styles.panelMove}>
                                <IconButton type="button" name="arrow-left" disabled={saving || position === 0}
                                  tooltip={`${label} előrébb helyezése`} onClick={() => move(-1)} />
                                <IconButton type="button" name="arrow-right" disabled={saving || position === panels.length - 1}
                                  tooltip={`${label} hátrébb helyezése`} onClick={() => move(1)} />
                              </div>
                              <div className={styles.panelDelete}>
                                <IconButton type="button" name="trash-alt" variant="destructive" disabled={saving}
                                  tooltip={`${label} eltávolítása`} onClick={() => setPanelToRemove({ index, panel, label })} />
                              </div>
                            </article>
                          );
                        })}
                        <button type="button" className={styles.panelAdd} disabled={saving}
                          onClick={() => editPanel(null, value)}>
                          <Icon name="plus" aria-hidden /> Panel hozzáadása
                        </button>
                      </div>
                    </details>
                  );
                })}
              </div>
              <div className={styles.formFooter}>
                <LinkButton variant="secondary" fill="outline" icon={menu.monitoring.icon}
                  href={config.appSubUrl + menu.monitoring.path + '?var-machine=' + encodeURIComponent(machine) + '&var-dashboard=' + assignment.id}>
                  Monitoring megnyitása
                </LinkButton>
                <div className={styles.actions}>
                  <Button type="button" icon="trash-alt" variant="destructive" fill="outline" disabled={saving}
                    onClick={() => setConfirmDelete(true)}>Dashboard törlése</Button>
                  <Button type="submit" icon="save" disabled={saving}>{saving ? 'Mentés…' : 'Dashboard mentése'}</Button>
                </div>
              </div>
            </>
          )}
        </form>
        {renameDraft !== undefined && (
          <Modal title="Dashboard átnevezése" isOpen onDismiss={() => setRenameDraft(undefined)}>
            <form onSubmit={(event) => {
              event.preventDefault();
              if (renameDraft.trim()) {
                setDashboardName(renameDraft.trim());
                setRenameDraft(undefined);
              }
            }}>
              <Field label="Dashboard neve" htmlFor="dashboard-rename">
                <Input id="dashboard-rename" autoFocus maxLength={120} value={renameDraft}
                  onChange={(event) => setRenameDraft(event.currentTarget.value)} />
              </Field>
              <Modal.ButtonRow>
                <Button type="button" variant="secondary" onClick={() => setRenameDraft(undefined)}>Mégse</Button>
                <Button type="submit" disabled={!renameDraft.trim()}>Név módosítása</Button>
              </Modal.ButtonRow>
            </form>
          </Modal>
        )}
        {creating && (
          <Modal title="Dashboard hozzáadása" isOpen onDismiss={() => !saving && setCreating(false)}>
            {createError && <Alert severity="error" title="A dashboard nem hozható létre">{createError}</Alert>}
            <Field label="Dashboard neve" htmlFor="new-dashboard-name">
              <Input id="new-dashboard-name" autoFocus maxLength={120} value={dashboardName}
                onChange={(event) => setDashboardName(event.currentTarget.value)} />
            </Field>
            <Field label="Kiindulás" htmlFor="new-dashboard-source">
              <Combobox id="new-dashboard-source" value={copySourceId} isClearable={false}
                loading={!dashboards && !error} disabled={saving || (!dashboards && !error)}
                options={[{ value: 0, label: 'Új, üres dashboard' }, ...copySources.map((source) => ({
                  value: source.id, label: `${source.name} · ${source.agent} / ${source.machine}`,
                }))]}
                onChange={(option) => setCopySourceId(option.value)} />
            </Field>
            <Modal.ButtonRow>
              <Button type="button" variant="secondary" disabled={saving} onClick={() => setCreating(false)}>Mégse</Button>
              <Button type="button" disabled={saving || !dashboardName.trim()} onClick={createDashboard}>Létrehozás</Button>
            </Modal.ButtonRow>
          </Modal>
        )}
        {confirmDelete && (
          <ConfirmModal isOpen title="Dashboard törlése" body="A dashboard panelbeállításai törlődnek."
            modalClass={styles.deleteConfirmation}
            confirmText="Dashboard törlése" dismissText="Mégse" confirmVariant="destructive"
            disabled={saving} onConfirm={deleteDashboard} onDismiss={() => setConfirmDelete(false)} />
        )}
        {panelToRemove && (
          <ConfirmModal isOpen title="Panel eltávolítása"
            modalClass={styles.deleteConfirmation}
            body={`A „${panelToRemove.label}” panel a dashboard mentésekor kerül le a dashboardról.`}
            confirmText="Panel eltávolítása" dismissText="Mégse" confirmVariant="destructive"
            disabled={saving} onConfirm={removePanel} onDismiss={() => setPanelToRemove(undefined)} />
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
