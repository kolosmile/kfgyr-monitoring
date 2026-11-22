import React, { useEffect, useState } from 'react';
import { Alert, Button, Icon, Input, Modal, Spinner, useStyles2 } from '@grafana/ui';
import { api } from '../api';
import { getStyles } from '../components/styles';
import { errorText } from '../types';

type DisplayUnit = { code: string; label: string };
type DisplayUnitsResponse = { units: DisplayUnit[] };

export function DisplayUnitsSettings({ onChange }: { onChange: (labels: Map<string, string>) => void }) {
  const styles = useStyles2(getStyles);
  const [units, setUnits] = useState<DisplayUnit[]>();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    api<DisplayUnitsResponse>('display-units').then(({ units }) => {
      if (active) {
        setUnits(units);
        onChange(new Map(units.map(({ code, label }) => [code, label])));
      }
    }).catch((err) => {
      if (active) {
        setError(errorText(err));
      }
    });
    return () => { active = false; };
  }, [loadAttempt, onChange]);

  const search = query.trim().toLocaleLowerCase('hu');
  const visibleUnits = units?.filter(({ code, label }) => `${code} ${label}`.toLocaleLowerCase('hu').includes(search));
  const changedLabels = Object.fromEntries((units ?? []).flatMap(({ code, label }) => {
    const edited = draft[code]?.trim();
    return edited !== undefined && edited !== label ? [[code, edited]] : [];
  }));
  const hasChanges = Object.keys(changedLabels).length > 0;

  async function save() {
    if (saving || !hasChanges) {
      return;
    }
    setSaving(true);
    setError('');
    try {
      const { units } = await api<DisplayUnitsResponse>('display-units', 'PUT', { labels: changedLabels });
      setUnits(units);
      onChange(new Map(units.map(({ code, label }) => [code, label])));
      setOpen(false);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button type="button" variant="secondary" icon="calculator-alt" className={styles.displayUnitsButton} onClick={() => {
        setDraft({});
        setQuery('');
        if (units) {
          setError('');
        }
        setOpen(true);
      }}>Megjelenítési mértékegységek</Button>
      {open && (
        <Modal title="Megjelenítési mértékegységek" className={styles.displayUnitsModal} isOpen
          closeOnEscape={!saving} closeOnBackdropClick={!saving} onDismiss={saving ? undefined : () => setOpen(false)}>
          <Input aria-label="Mértékegységek keresése" placeholder="Mértékegység keresése…"
            prefix={<Icon name="search" />} value={query} onChange={(event) => setQuery(event.currentTarget.value)} />
          <p className={styles.muted}>Üres mezőnél az eredeti MTConnect-kód jelenik meg.</p>
          {error && <Alert severity="error" title="A művelet sikertelen">{error}</Alert>}
          {!units && (error ? (
            <Button type="button" variant="secondary" onClick={() => {
              setError('');
              setLoadAttempt((attempt) => attempt + 1);
            }}>Újrapróbálás</Button>
          ) : <div role="status"><Spinner /> Mértékegységek betöltése…</div>)}
          {visibleUnits && (
            <div className={styles.displayUnitsScroll} role="region" aria-label="MTConnect-mértékegységek" tabIndex={0}>
              <table className={styles.displayUnitsTable}>
                <thead><tr><th scope="col">MTConnect-kód</th><th scope="col">Megjelenítés</th></tr></thead>
                <tbody>
                  {visibleUnits.map(({ code, label }) => (
                    <tr key={code}>
                      <th scope="row">{code}</th>
                      <td>
                        <Input aria-label={`${code} megjelenítési egysége`} value={draft[code] ?? label}
                          maxLength={40} disabled={saving}
                          onChange={(event) => {
                            const value = event.currentTarget.value;
                            setDraft((current) => ({ ...current, [code]: value }));
                          }} />
                      </td>
                    </tr>
                  ))}
                  {!visibleUnits.length && <tr><td colSpan={2}>Nincs a keresésnek megfelelő mértékegység.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
          <Modal.ButtonRow>
            <Button type="button" variant="secondary" disabled={saving} onClick={() => setOpen(false)}>Mégse</Button>
            <Button type="button" disabled={saving || !hasChanges} onClick={save}>Mentés</Button>
          </Modal.ButtonRow>
        </Modal>
      )}
    </>
  );
}
