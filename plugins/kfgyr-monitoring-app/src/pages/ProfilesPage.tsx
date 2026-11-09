import React, { useEffect, useState } from 'react';
import { PluginPage } from '@grafana/runtime';
import { Alert, Badge, Button, Combobox, Field, Spinner, useStyles2 } from '@grafana/ui';
import { api } from '../api';
import { getStyles } from '../components/styles';
import { errorText } from '../types';

type Option = { id: string; label: string };
type Catalog = { profiles: Record<string, { label: string; signals: Record<string, string> }>; machines: Option[] };
type Assignment = { profile: string; signals: Record<string, string>; revision: number; options: Option[] };

export function ProfilesPage() {
  const styles = useStyles2(getStyles);
  const [catalog, setCatalog] = useState<Catalog>();
  const [machine, setMachine] = useState('');
  const [assignment, setAssignment] = useState<Assignment>();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
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

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!assignment) {
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const { profile, signals, revision } = assignment;
      const result = await api<{ revision: number }>('machine-monitoring', 'PUT', { machine, profile, signals, revision });
      setAssignment({ ...assignment, revision: result.revision });
      setNotice('A gépprofil mentve.');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  const profile = assignment && catalog?.profiles[assignment.profile];
  const signalOptions = assignment?.options.map(({ id, label }) => ({ value: id, label })) ?? [];
  const slots = Object.entries(profile?.signals ?? {});
  const assignedCount = slots.filter(([slot]) => signalOptions.some(({ value }) => value === assignment?.signals[slot])).length;
  return (
    <PluginPage pageNav={{ text: 'Gépprofilok' }}>
      <div className={styles.page}>
        <form onSubmit={save} className={styles.form}>
          {error && <Alert severity="error" title="A gépprofil művelete sikertelen">{error}</Alert>}
          {notice && <Alert severity="success" title={notice} />}
          <section className={styles.formCard} aria-labelledby="profile-heading">
            <h3 id="profile-heading">Gép és profil</h3>
            <p className={styles.note}>Az első beolvasás után választható ki az Agentek és gépek oldalon felvett gép.</p>
            <div className={styles.grid}>
              <Field label="Gép" htmlFor="profile-machine">
                <Combobox
                  id="profile-machine"
                  value={machine || null}
                  options={catalog?.machines.map(({ id, label }) => ({ value: id, label })) ?? []}
                  placeholder="Keress gépnév alapján…"
                  noOptionsMessage="Nincs választható gép"
                  loading={!catalog && !error}
                  disabled={saving}
                  onChange={({ value }) => {
                    if (value === machine) {
                      return;
                    }
                    setAssignment(undefined);
                    setError('');
                    setNotice('');
                    setMachine(value);
                  }}
                />
              </Field>
              <Field label="Profil" htmlFor="machine-profile">
                <Combobox
                  id="machine-profile"
                  value={assignment?.profile ?? null}
                  options={[
                    ...Object.entries(catalog?.profiles ?? {}).map(([value, item]) => ({ value, label: item.label })),
                    ...(assignment && !profile ? [{ value: assignment.profile, label: 'Ismeretlen profil' }] : []),
                  ]}
                  placeholder="Válassz először gépet"
                  loading={!!machine && !assignment && !error}
                  disabled={!assignment || saving}
                  onChange={({ value }) => {
                    if (assignment && value !== assignment.profile) {
                      setNotice('');
                      setAssignment({ ...assignment, profile: value, signals: {} });
                    }
                  }}
                />
              </Field>
            </div>
          </section>
          {machine && !assignment && !error && <div role="status"><Spinner /> Gépprofil betöltése…</div>}
          {!machine && catalog && (
            <div className={styles.empty}>
              <h3>{catalog.machines.length ? 'Válassz egy gépet' : 'Még nincs beolvasott gép'}</h3>
              <p>A kiválasztott gép profilját és jel-hozzárendeléseit itt szerkesztheted.</p>
            </div>
          )}
          {assignment && profile && (
            <section className={styles.formCard} aria-labelledby="profile-signals-heading">
              <div className={styles.formFooter}>
                <h3 id="profile-signals-heading">Jel-hozzárendelések</h3>
                <Badge text={`${assignedCount} / ${slots.length} hozzárendelve`} color="blue" />
              </div>
              <p className={styles.note}>A kiválasztott adatpontok jelennek meg a gépmonitoring nézetben.</p>
              {!signalOptions.length && <Alert title="Ehhez a géphez még nincs adatpont." severity="info" />}
              <div className={styles.grid}>
                {slots.map(([slot, label]) => {
                  const saved = assignment.signals[slot];
                  const unavailable = saved && !signalOptions.some(({ value }) => value === saved);
                  return (
                    <Field key={slot} label={label} htmlFor={`signal-${slot}`}>
                      <Combobox
                        id={`signal-${slot}`}
                        value={saved ?? null}
                        options={unavailable ? [{ value: saved, label: 'A mentett adatpont nem érhető el' }, ...signalOptions] : signalOptions}
                        placeholder="Nincs hozzárendelve"
                        noOptionsMessage="Nincs találat"
                        isClearable
                        disabled={saving}
                        onChange={(option) => {
                          const signals = { ...assignment.signals };
                          if (option) {
                            signals[slot] = option.value;
                          } else {
                            delete signals[slot];
                          }
                          setNotice('');
                          setAssignment({ ...assignment, signals });
                        }}
                      />
                    </Field>
                  );
                })}
              </div>
              <div className={styles.footer}>
                <Button type="submit" icon={saving ? 'spinner' : 'save'} disabled={saving}>
                  {saving ? 'Mentés…' : 'Profil mentése'}
                </Button>
              </div>
            </section>
          )}
        </form>
      </div>
    </PluginPage>
  );
}
