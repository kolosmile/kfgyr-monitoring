import React, { useEffect, useState } from 'react';
import { HomeLink } from '../components/HomeLink';
import { PluginPage, config } from '@grafana/runtime';
import { Alert, Button, Combobox, ConfirmModal, Field, Icon, Input, Modal, Spinner, useStyles2 } from '@grafana/ui';
import { api } from '../api';
import { getStyles } from '../components/styles';
import { errorText } from '../types';

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
type Panel = { name: string; point: string; view: View; minimum?: number; maximum?: number; color?: ChartColor };
type Option = { id: string; label: string };
type Catalog = { presets: Array<{ label: string; panels: Panel[] }>; machines: Option[] };
type Assignment = { panels: Panel[]; revision: number; options: Option[] };

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
  const [preset, setPreset] = useState<number>();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editor, setEditor] = useState<{ index: number | null; panel: Panel }>();
  const [editorError, setEditorError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedPanels, setSavedPanels] = useState('');
  const [confirmBack, setConfirmBack] = useState(false);
  const dirty = !!assignment && JSON.stringify(assignment.panels) !== savedPanels;

  useEffect(() => {
    api<Catalog>('machines').then(setCatalog).catch((err) => setError(errorText(err)));
  }, []);

  useEffect(() => {
    if (!machine) {
      return;
    }
    let active = true;
    api<Assignment>(`machine-monitoring/${encodeURIComponent(machine)}`)
      .then((value) => {
        if (active) {
          setAssignment(value);
          setSavedPanels(JSON.stringify(value.panels));
        }
      })
      .catch((err) => active && setError(errorText(err)));
    return () => { active = false; };
  }, [machine]);

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
    setAssignment(undefined);
    setSavedPanels('');
    setEditor(undefined);
    setEditorError('');
    setPreset(undefined);
    setError('');
    setNotice('');
    setConfirmBack(false);
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
      panel: index === null ? { name: '', point: '', view: 'chart' } : { ...assignment.panels[index] },
    });
  }

  function applyPanel() {
    if (!editor || !assignment) {
      return;
    }
    const panel = { ...editor.panel, name: editor.panel.name.trim() };
    if (!panel.name || !panel.point) {
      setEditorError('Adj nevet és válassz adatpontot a panelhez.');
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
    const invalidIndex = panels.findIndex((panel) => !panel.name.trim() || !panel.point ||
      (panel.view === 'gauge' &&
        (!Number.isFinite(panel.minimum) || !Number.isFinite(panel.maximum) || !(panel.minimum! < panel.maximum!))));
    if (invalidIndex !== -1) {
      editPanel(invalidIndex);
      setError('Adj nevet és adatpontot minden panelnek. A műszer maximuma pedig legyen nagyobb a minimumnál.');
      return;
    }
    setSaving(true);
    try {
      const result = await api<{ revision: number }>('machine-monitoring', 'PUT', { machine, panels, revision });
      setAssignment({ ...assignment, revision: result.revision });
      setSavedPanels(JSON.stringify(panels));
      setNotice('A monitoring beállításai mentve.');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  const points = assignment?.options.map(({ id, label }) => ({ value: id, label })) ?? [];
  const groups = new Map<string, Option[]>();
  for (const item of catalog?.machines ?? []) {
    const separator = item.label.indexOf('/');
    const agent = separator < 0 ? 'Egyéb' : item.label.slice(0, separator);
    groups.set(agent, [...(groups.get(agent) || []), item]);
  }
  const selected = catalog?.machines.find((item) => item.id === machine);
  return (
    <PluginPage pageNav={{ text: 'Monitoring beállítása' }} actions={<HomeLink />}>
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
                    onClick={() => dirty ? setConfirmBack(true) : backToMachines()}>
                    Vissza a gépekhez
                  </Button>
                </div>
                <strong>{selected?.label}</strong>
              </div>
            </section>
          )}
          {machine && !assignment && !error && <div role="status"><Spinner /> Beállítások betöltése…</div>}
          {assignment && (
            <>
              <section className={styles.formCard}>
                <h3>Panelek</h3>
                <p className={styles.note}>Kezdj üres listával, vagy adj hozzá szerkeszthető paneljavaslatokat. A sorrend nézetenként érvényesül.</p>
                <Field label="Panelsablon csomag" htmlFor="panel-preset">
                  <Combobox id="panel-preset" disabled={saving} value={preset ?? null}
                    options={catalog?.presets.map(({ label }, value) => ({ value, label })) ?? []}
                    onChange={({ value }) => setPreset(value)} />
                </Field>
                <div className={styles.actions}>
                  <Button type="button" variant="secondary" disabled={saving || preset === undefined} onClick={() => {
                    const items = preset === undefined ? undefined : catalog?.presets[preset];
                    if (items) {
                      changePanels([...assignment.panels, ...items.panels]);
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
                        const point = points.find((item) => item.value === panel.point);
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
                            <strong>{panel.name || 'Névtelen panel'}</strong>
                            <div className={styles.panelPoint}>
                              {point?.label || (panel.point ? 'A mentett adatpont nem érhető el' : 'Nincs kiválasztott adatpont')}
                            </div>
                            <div className={styles.actions}>
                              <Button type="button" variant="secondary" icon="arrow-up" disabled={saving || position === 0}
                                aria-label={`${panel.name || 'Panel'} előrébb helyezése`} onClick={() => move(-1)} />
                              <Button type="button" variant="secondary" icon="arrow-down" disabled={saving || position === panels.length - 1}
                                aria-label={`${panel.name || 'Panel'} hátrébb helyezése`} onClick={() => move(1)} />
                              <Button type="button" variant="secondary" icon="pen" disabled={saving}
                                aria-label={`${panel.name || 'Panel'} szerkesztése`} onClick={() => editPanel(index)} />
                              <Button type="button" variant="destructive" icon="trash-alt" disabled={saving}
                                aria-label={`${panel.name || 'Panel'} eltávolítása`}
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
                <a href={config.appSubUrl + '/d/kfgyr-machine-monitoring?var-machine=' + encodeURIComponent(machine)}>Gépmonitoring megnyitása</a>
                <Button type="submit" icon="save" disabled={saving}>{saving ? 'Mentés…' : 'Panelek mentése'}</Button>
              </div>
            </>
          )}
        </form>
        {editor && (
          <Modal title={editor.index === null ? 'Új panel' : 'Panel szerkesztése'} isOpen
            onDismiss={() => setEditor(undefined)}>
            {editorError && <Alert severity="error" title={editorError} />}
            <Field label="Megjelenített név" htmlFor="panel-name">
              <Input id="panel-name" maxLength={120} value={editor.panel.name}
                onChange={(event) => setEditor({ ...editor, panel: { ...editor.panel, name: event.currentTarget.value } })} />
            </Field>
            <Field label="Adatpont" htmlFor="panel-point">
              <Combobox id="panel-point" value={editor.panel.point || null}
                options={editor.panel.point && !points.some((point) => point.value === editor.panel.point)
                  ? [{ value: editor.panel.point, label: 'A mentett adatpont nem érhető el' }, ...points] : points}
                onChange={({ value, label }) => setEditor({ ...editor, panel: {
                  ...editor.panel, point: value, name: editor.panel.name || label || value,
                } })} />
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
            onConfirm={backToMachines} onDismiss={() => setConfirmBack(false)} />
        )}
      </div>
    </PluginPage>
  );
}
