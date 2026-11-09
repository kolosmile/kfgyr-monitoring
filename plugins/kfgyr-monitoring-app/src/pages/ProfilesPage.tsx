import React, { useEffect, useState } from 'react';
import { PluginPage } from '@grafana/runtime';
import { Alert, Button, Field, Spinner } from '@grafana/ui';
import { api } from '../api';
import { errorText } from '../types';

type Option = { id: string; label: string };
type Catalog = { profiles: Record<string, { label: string; signals: Record<string, string> }>; machines: Option[] };
type Assignment = { profile: string; signals: Record<string, string>; revision: number; options: Option[] };

export function ProfilesPage() {
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
  return (
    <PluginPage pageNav={{ text: 'Gépprofilok' }}>
      <p>Az Agentek és gépek oldalon kösd be a gépet. A gép az első beolvasás után választható itt.</p>
      {error && <Alert severity="error" title={error} />}
      {notice && <Alert severity="success" title={notice} />}
      {!catalog && !error && <Spinner />}
      <form onSubmit={save} style={{ maxWidth: 760 }}>
        <fieldset disabled={saving} style={{ border: 0, padding: 0, margin: 0 }}>
          <Field label="Gép" htmlFor="profile-machine">
            <select id="profile-machine" value={machine} onChange={(event) => {
              setAssignment(undefined);
              setError('');
              setNotice('');
              setMachine(event.target.value);
            }}>
              <option value="">Válassz gépet</option>
              {catalog?.machines.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </Field>
          {machine && !assignment && !error && <Spinner />}
          {assignment && <>
            <Field label="Profil" htmlFor="machine-profile">
              <select id="machine-profile" value={assignment.profile} onChange={(event) =>
                setAssignment({ ...assignment, profile: event.target.value, signals: {} })}>
                {!profile && <option value={assignment.profile}>Ismeretlen profil</option>}
                {Object.entries(catalog?.profiles ?? {}).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}
              </select>
            </Field>
            {Object.entries(profile?.signals ?? {}).map(([slot, label]) =>
              <Field key={slot} label={label} htmlFor={`signal-${slot}`}>
                <select id={`signal-${slot}`} value={assignment.signals[slot] ?? ''} onChange={(event) => {
                  const signals = { ...assignment.signals };
                  if (event.target.value) {
                    signals[slot] = event.target.value;
                  } else {
                    delete signals[slot];
                  }
                  setAssignment({ ...assignment, signals });
                }}>
                  <option value="">Nincs hozzárendelve</option>
                  {assignment.options.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              </Field>)}
            <Button type="submit" disabled={!profile}>Profil mentése</Button>
          </>}
        </fieldset>
      </form>
    </PluginPage>
  );
}
