import React, { useEffect, useState } from 'react';
import { HomeLink } from '../components/HomeLink';
import { PluginPage, config } from '@grafana/runtime';
import { Alert, Button, Combobox, Field, Input, Spinner, useStyles2 } from '@grafana/ui';
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
  { value: 'value', label: 'Aktuális érték' },
  { value: 'state', label: 'Állapot' },
  { value: 'chart', label: 'Grafikon' },
  { value: 'gauge', label: 'Műszer' },
];

export function ProfilesPage() {
  const styles = useStyles2(getStyles);
  const [catalog, setCatalog] = useState<Catalog>();
  const [machine, setMachine] = useState('');
  const [assignment, setAssignment] = useState<Assignment>();
  const [preset, setPreset] = useState<number>();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [expanded, setExpanded] = useState<number>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<Catalog>('machines').then(setCatalog).catch((err) => setError(errorText(err)));
  }, []);

  useEffect(() => {
    if (!machine) {
      return;
    }
    let active = true;
    api<Assignment>(`machine-monitoring/${encodeURIComponent(machine)}`)
      .then((value) => active && setAssignment(value))
      .catch((err) => active && setError(errorText(err)));
    return () => { active = false; };
  }, [machine]);

  function changePanels(panels: Panel[]) {
    setAssignment((current) => current && { ...current, panels });
    setNotice('');
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
      setExpanded(invalidIndex);
      setError('Adj nevet és adatpontot minden panelnek. A műszer maximuma pedig legyen nagyobb a minimumnál.');
      return;
    }
    setSaving(true);
    try {
      const result = await api<{ revision: number }>('machine-monitoring', 'PUT', { machine, panels, revision });
      setAssignment({ ...assignment, revision: result.revision });
      setNotice('A monitoring beállításai mentve.');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  const points = assignment?.options.map(({ id, label }) => ({ value: id, label })) ?? [];
  return (
    <PluginPage pageNav={{ text: 'Monitoring beállítása' }} actions={<HomeLink />}>
      <div className={styles.page}>
        <form onSubmit={save} className={styles.form}>
          {error && <Alert severity="error" title="A művelet sikertelen">{error}</Alert>}
          {notice && <Alert severity="success" title={notice} />}
          <section className={styles.formCard}>
            <Field label="Gép" htmlFor="profile-machine">
              <Combobox id="profile-machine" value={machine || null} disabled={saving}
                options={catalog?.machines.map(({ id, label }) => ({ value: id, label })) ?? []}
                placeholder="Keress gépnév alapján…" loading={!catalog && !error}
                noOptionsMessage="Az első adatbeolvasás után választható gép."
                onChange={({ value }) => {
                  if (value !== machine) {
                    setAssignment(undefined);
                    setExpanded(undefined);
                    setPreset(undefined);
                    setError('');
                    setNotice('');
                    setMachine(value);
                  }
                }}
              />
            </Field>
          </section>
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
                    onClick={() => {
                      setExpanded(assignment.panels.length);
                      changePanels([...assignment.panels, { name: '', point: '', view: 'chart' }]);
                    }}>
                    Panel hozzáadása
                  </Button>
                </div>
              </section>
              {assignment.panels.map((panel, index, panels) => {
                const update = (values: Partial<Panel>) => changePanels(panels.map((item, i) => i === index ? { ...item, ...values } : item));
                const move = (offset: number) => {
                  const next = [...panels];
                  next.splice(index, 1);
                  next.splice(index + offset, 0, panel);
                  setExpanded(index + offset);
                  changePanels(next);
                };
                const unavailable = panel.point && !points.some((point) => point.value === panel.point);
                return (
                  <section key={index} className={styles.formCard} style={{ paddingBlock: 8 }}>
                    <div className={styles.formFooter}>
                      <Button type="button" variant="secondary" aria-expanded={expanded === index}
                        onClick={() => setExpanded(expanded === index ? undefined : index)}>
                        {index + 1}. {panel.name || 'Új panel'} · {views.find(({ value }) => value === panel.view)?.label}
                        {!panel.point && ' · Nincs adatpont'}
                      </Button>
                      <div className={styles.actions}>
                        <Button type="button" variant="secondary" disabled={saving || index === 0} onClick={() => move(-1)}>Fel</Button>
                        <Button type="button" variant="secondary" disabled={saving || index === panels.length - 1} onClick={() => move(1)}>Le</Button>
                        <Button type="button" variant="destructive" disabled={saving}
                          onClick={() => {
                            setExpanded(undefined);
                            changePanels(panels.filter((_, i) => i !== index));
                          }}>Eltávolítás</Button>
                      </div>
                    </div>
                    {expanded === index && <div style={{ paddingTop: 12 }}>
                      <Field label="Megjelenített név" htmlFor={`panel-name-${index}`}>
                        <Input id={`panel-name-${index}`} disabled={saving} maxLength={120} value={panel.name}
                          onChange={(event) => update({ name: event.currentTarget.value })} />
                      </Field>
                      <div className={styles.grid}>
                        <Field label="Adatpont" htmlFor={`panel-point-${index}`}>
                          <Combobox id={`panel-point-${index}`} disabled={saving} value={panel.point || null}
                            options={unavailable ? [{ value: panel.point, label: 'A mentett adatpont nem érhető el' }, ...points] : points}
                            onChange={({ value, label }) => update({ point: value, name: panel.name || label || value })} />
                        </Field>
                        <Field label="Nézet" htmlFor={`panel-view-${index}`}>
                          <Combobox id={`panel-view-${index}`} disabled={saving} value={panel.view} options={views}
                            onChange={({ value }) => update({ view: value })} />
                        </Field>
                      </div>
                      {panel.view === 'chart' && (
                        <Field label="Vonalszín" htmlFor={`panel-color-${index}`}>
                          <Combobox id={`panel-color-${index}`} disabled={saving}
                            value={panel.color ?? null} options={chartColors} placeholder="Automatikus"
                            isClearable onChange={(option) => update({ color: option?.value })} />
                        </Field>
                      )}
                      {panel.view === 'gauge' && (
                        <div className={styles.grid}>
                          {(['minimum', 'maximum'] as const).map((bound) => (
                            <Field key={bound} label={bound === 'minimum' ? 'Minimum' : 'Maximum'} htmlFor={`panel-${bound}-${index}`}>
                              <Input id={`panel-${bound}-${index}`} type="number" step="any" disabled={saving} value={panel[bound] ?? ''}
                                onChange={(event) => update({ [bound]: event.currentTarget.value === '' ? undefined : event.currentTarget.valueAsNumber })} />
                            </Field>
                          ))}
                        </div>
                      )}
                    </div>}
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
      </div>
    </PluginPage>
  );
}
