import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Combobox, ConfirmModal, Field, Input, Modal, Spinner, useStyles2 } from '@grafana/ui';
import { api } from '../api';
import { getStyles } from '../components/styles';
import { errorText, SchemaOption, Signal } from '../types';

type Machine = { id: string; label: string; schema_id?: string };
type DataItem = { id: string; path: string; units: string; category: string; type: string; subType: string };
type Mapping = { signal_id: string; signal_name: string; signal_units: string; endpoint: string | null };
type MappingResponse = { mappings: Mapping[] };
type CatalogResponse = { signals: Signal[] };
type SchemaResponse = { schemas: SchemaOption[] };
type MachinesResponse = { machines: Machine[] };
type SignalEditor = {
  mode: 'catalog' | 'machine';
  originalId?: string;
  id: string;
  name: string;
  units: string;
  machine: string;
  pointId: string;
  endpoint: string;
};
type SchemaEditor = { id?: string; name: string };
type MappingEditor = { signalId: string; source: 'manual' | 'machine'; machine: string; endpoint: string };

function suggestId(path: string) {
  return path.replace(/^\/+/, '').toLowerCase().replace(/\[([^\]]+)\]/g, '_$1')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 128) || 'signal';
}

function suggestName(item: DataItem) {
  const axis = item.path.match(/(?:Linear|Rotary)\[([^\]]+)\]/)?.[1];
  if (item.type === 'POSITION' || item.type === 'ANGLE') {
    return axis ? `${axis} tengely pozíció` : 'Pozíció';
  }
  if (item.type === 'ROTARY_VELOCITY' || item.type === 'SPINDLE_SPEED') {
    return axis ? `${axis} orsófordulat` : 'Orsófordulat';
  }
  if (item.type === 'EXECUTION') {
    return 'Programállapot';
  }
  return item.path.split('/').filter(Boolean).pop() || item.type || 'Új jel';
}

export function SchemaManager() {
  const styles = useStyles2(getStyles);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [schemas, setSchemas] = useState<SchemaOption[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [selectedSchema, setSelectedSchema] = useState('');
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [machineItems, setMachineItems] = useState<DataItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [signalEditor, setSignalEditor] = useState<SignalEditor>();
  const [schemaEditor, setSchemaEditor] = useState<SchemaEditor>();
  const [mappingEditor, setMappingEditor] = useState<MappingEditor>();
  const [deleteSignal, setDeleteSignal] = useState<Signal>();
  const [deleteSchema, setDeleteSchema] = useState<SchemaOption>();
  const [submitted, setSubmitted] = useState(false);

  async function loadBase(preferredSchema = selectedSchema) {
    const [catalog, schemaResult, machineResult] = await Promise.all([
      api<CatalogResponse>('signals'),
      api<SchemaResponse>('schemas'),
      api<MachinesResponse>('machines'),
    ]);
    setSignals(catalog.signals);
    setSchemas(schemaResult.schemas);
    setMachines(machineResult.machines);
    const nextSchema = schemaResult.schemas.some((item) => item.id === preferredSchema)
      ? preferredSchema : schemaResult.schemas[0]?.id || '';
    setSelectedSchema(nextSchema);
    return nextSchema;
  }

  async function loadMappings(schemaId: string) {
    if (!schemaId) {
      setMappings([]);
      return;
    }
    const result = await api<MappingResponse>(`schemas/${encodeURIComponent(schemaId)}/mappings`);
    setMappings(result.mappings);
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const schemaId = await loadBase('');
        if (active) {
          await loadMappings(schemaId);
        }
      } catch (err) {
        if (active) {
          setError(errorText(err));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();
    return () => { active = false; };
  }, []);

  const activeMachine = signalEditor?.mode === 'machine' ? signalEditor.machine : mappingEditor?.source === 'machine'
    ? mappingEditor.machine : '';
  useEffect(() => {
    let active = true;
    if (!activeMachine) {
      setMachineItems([]);
      return () => { active = false; };
    }
    api<{ dataitems: DataItem[] }>(`machines/${encodeURIComponent(activeMachine)}/dataitems`)
      .then((result) => active && setMachineItems(result.dataitems))
      .catch((err) => active && setError(errorText(err)));
    return () => { active = false; };
  }, [activeMachine]);

  const mappingBySignal = useMemo(() => new Map(mappings.map((item) => [item.signal_id, item])), [mappings]);
  const usedEndpoints = useMemo(() => new Set(mappings
    .filter((item) => item.endpoint && item.signal_id !== mappingEditor?.signalId)
    .map((item) => item.endpoint!)), [mappings, mappingEditor?.signalId]);
  const availableMachineItems = machineItems.filter((item) => !usedEndpoints.has(item.path));

  async function reload(schemaId = selectedSchema) {
    setError('');
    const next = await loadBase(schemaId);
    await loadMappings(next);
  }

  async function saveSignal() {
    if (!signalEditor || saving) {
      return;
    }
    setSubmitted(true);
    const { id, name, units, originalId, mode, endpoint } = signalEditor;
    if (!name.trim() || !id.trim() || (mode === 'machine' && !endpoint)) {
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (originalId) {
        await api('signals', 'PUT', { id: originalId, name: name.trim(), units: units.trim() });
      } else {
        await api('signals', 'POST', { id: id.trim(), name: name.trim(), units: units.trim() });
        if (mode === 'machine' && selectedSchema) {
          await api(`schemas/${encodeURIComponent(selectedSchema)}/mappings`, 'PUT', {
            signal_id: id.trim(), endpoint,
          });
        }
      }
      setSignalEditor(undefined);
      setSubmitted(false);
      setNotice(originalId ? 'A jel adatai frissültek.' : mode === 'machine'
        ? 'A jel bekerült a katalógusba és a sémához rendeltük.'
        : 'A jel bekerült a katalógusba. A séma-hozzárendelés külön adható meg.');
      await reload(selectedSchema);
    } catch (err) {
      setError(errorText(err));
      await reload(selectedSchema).catch(() => undefined);
    } finally {
      setSaving(false);
    }
  }

  async function saveSchema() {
    if (!schemaEditor || saving || !schemaEditor.name.trim()) {
      return;
    }
    setSaving(true);
    setError('');
    try {
      let preferredSchema = selectedSchema;
      if (schemaEditor.id) {
        await api(`schemas/${encodeURIComponent(schemaEditor.id)}`, 'PUT', { name: schemaEditor.name.trim() });
        preferredSchema = schemaEditor.id;
      } else {
        const result = await api<{ schema: SchemaOption }>('schemas', 'POST', { name: schemaEditor.name.trim() });
        preferredSchema = result.schema.id;
      }
      setSchemaEditor(undefined);
      await reload(preferredSchema);
      setNotice('A séma mentése sikerült.');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  async function saveMapping() {
    if (!mappingEditor || saving || !selectedSchema || !mappingEditor.endpoint.trim()) {
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api(`schemas/${encodeURIComponent(selectedSchema)}/mappings`, 'PUT', {
        signal_id: mappingEditor.signalId,
        endpoint: mappingEditor.endpoint.trim(),
      });
      setMappingEditor(undefined);
      setNotice('A séma-hozzárendelés mentve.');
      await reload(selectedSchema);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  async function removeSignal() {
    if (!deleteSignal || saving) {
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api(`signals/${encodeURIComponent(deleteSignal.id)}`, 'DELETE');
      setNotice('A jel törölve.');
      setDeleteSignal(undefined);
      await reload(selectedSchema);
    } catch (err) {
      setError(errorText(err));
      setDeleteSignal(undefined);
    } finally {
      setSaving(false);
    }
  }

  async function removeSchema() {
    if (!deleteSchema || saving) {
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api(`schemas/${encodeURIComponent(deleteSchema.id)}`, 'DELETE');
      setNotice('A séma törölve.');
      const nextId = schemas.find((item) => item.id !== deleteSchema.id)?.id || '';
      setDeleteSchema(undefined);
      await reload(nextId);
    } catch (err) {
      setError(errorText(err));
      setDeleteSchema(undefined);
    } finally {
      setSaving(false);
    }
  }

  async function removeMapping(signalId: string) {
    if (!selectedSchema || saving) {
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api(`schemas/${encodeURIComponent(selectedSchema)}/mappings/${encodeURIComponent(signalId)}`, 'DELETE');
      setNotice('A hozzárendelés törölve; a jel a katalógusban megmaradt.');
      await reload(selectedSchema);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  function openMapping(signalId: string) {
    const current = mappingBySignal.get(signalId);
    setMappingEditor({ signalId, source: 'manual', machine: '', endpoint: current?.endpoint || '' });
  }

  const mappingSignal = mappingEditor && signals.find((item) => item.id === mappingEditor.signalId);
  const selectedDataItem = mappingEditor && machineItems.find((item) => item.path === mappingEditor.endpoint);
  const unitMismatch = !!selectedDataItem && mappingSignal?.units !== selectedDataItem.units;

  if (loading) {
    return <div role="status"><Spinner /> A jelkatalógus és a sémák betöltése…</div>;
  }

  return (
    <>
      {error && <Alert severity="error" title="A művelet sikertelen">{error}</Alert>}
      {notice && <Alert severity="success" title={notice} />}
      <div className={styles.schemaColumns}>
        <section className={styles.formCard}>
          <div className={styles.formFooter}>
            <div><h3>Jelkatalógus</h3><p className={styles.muted}>A magyar nevek és egységek közös listája.</p></div>
            <Button type="button" icon="plus" disabled={saving} onClick={() => {
              setSubmitted(false);
              setSignalEditor({ mode: 'catalog', id: '', name: '', units: '', machine: '', pointId: '', endpoint: '' });
            }}>Jel hozzáadása</Button>
          </div>
          {!signals.length && <p className={styles.muted}>A katalógus még üres.</p>}
          <div className={styles.schemaList}>
            {signals.map((signal) => (
              <div className={styles.schemaRow} key={signal.id}>
                <div className={styles.schemaRowText}>
                  <strong>{signal.name}</strong>
                  <small>{signal.id} · {signal.units || 'Nincs megadott egység'}</small>
                </div>
                <div className={styles.schemaActions}>
                  <Button type="button" size="sm" variant="secondary" icon="pen" aria-label={`${signal.name} módosítása`}
                    disabled={saving} onClick={() => {
                      setSubmitted(false);
                      setSignalEditor({ mode: 'catalog', originalId: signal.id, id: signal.id,
                        name: signal.name, units: signal.units, machine: '', pointId: '', endpoint: '' });
                    }} />
                  <Button type="button" size="sm" variant="destructive" icon="trash-alt" aria-label={`${signal.name} törlése`}
                    disabled={saving} onClick={() => setDeleteSignal(signal)} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.formCard}>
          <div className={styles.formFooter}>
            <div><h3>Sémák és végpontok</h3><p className={styles.muted}>A séma gépen belüli útvonalakat rendel a jelekhez.</p></div>
            <Button type="button" icon="plus" disabled={saving} onClick={() => {
              setSubmitted(false);
              setSchemaEditor({ name: '' });
            }}>Séma hozzáadása</Button>
          </div>
          <Field label="Séma" htmlFor="schema-select">
            <Combobox id="schema-select" value={selectedSchema || null}
              placeholder="Válassz sémát" options={schemas.map((schema) => ({ value: schema.id, label: schema.name }))}
              onChange={async ({ value }) => {
                setSelectedSchema(value || '');
                setError('');
                try { await loadMappings(value || ''); } catch (err) { setError(errorText(err)); }
              }} />
          </Field>
          {selectedSchema && (
            <>
              <div className={styles.actions}>
                <Button type="button" variant="secondary" icon="pen" disabled={saving}
                  onClick={() => {
                    setSubmitted(false);
                    setSchemaEditor({ id: selectedSchema, name: schemas.find((item) => item.id === selectedSchema)?.name || '' });
                  }}>
                  Séma átnevezése
                </Button>
                <Button type="button" variant="secondary" icon="plus" disabled={saving}
                  onClick={() => {
                    setSubmitted(false);
                    setSignalEditor({ mode: 'machine', id: '', name: '', units: '', machine: '', pointId: '', endpoint: '' });
                  }}>
                  Új jel gépadatpontból
                </Button>
                <Button type="button" variant="destructive" icon="trash-alt" disabled={saving}
                  onClick={() => setDeleteSchema(schemas.find((item) => item.id === selectedSchema))}>
                  Séma törlése
                </Button>
              </div>
              {!signals.length && <p className={styles.muted}>Előbb vegyél fel legalább egy jelet a katalógusba.</p>}
              <div className={styles.schemaList}>
                {mappings.map((mapping) => (
                  <div className={styles.schemaRow} key={mapping.signal_id}>
                    <div className={styles.schemaRowText}>
                      <strong>{mapping.signal_name}</strong>
                      <small>{mapping.signal_id} · {mapping.signal_units || 'Nincs megadott egység'}</small>
                      <div className={styles.schemaPath}>{mapping.endpoint || 'Nincs hozzárendelve ebben a sémában'}</div>
                    </div>
                    <div className={styles.schemaActions}>
                      <Button type="button" size="sm" variant="secondary" icon={mapping.endpoint ? 'pen' : 'plus'}
                        aria-label={`${mapping.signal_name} hozzárendelése`} disabled={saving}
                        onClick={() => openMapping(mapping.signal_id)}>
                        {mapping.endpoint ? 'Módosítás' : 'Hozzárendelés'}
                      </Button>
                      {mapping.endpoint && <Button type="button" size="sm" variant="destructive" icon="trash-alt"
                        aria-label={`${mapping.signal_name} hozzárendelés törlése`} disabled={saving}
                        onClick={() => removeMapping(mapping.signal_id)} />}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {!schemas.length && <p className={styles.muted}>Hozz létre sémát, majd rendelj hozzá katalógusjeleket.</p>}
        </section>
      </div>

      {signalEditor && (
        <Modal title={signalEditor.originalId ? 'Jel módosítása' : signalEditor.mode === 'machine' ? 'Új jel gépadatpontból' : 'Jel hozzáadása'}
          isOpen onDismiss={() => setSignalEditor(undefined)}>
          <div className={styles.schemaModalFields}>
            {signalEditor.mode === 'machine' && (
              <>
                <Field label="Gép" htmlFor="new-signal-machine">
                  <Combobox id="new-signal-machine" value={signalEditor.machine || null} placeholder="Válassz gépet"
                    options={machines.map((item) => ({ value: item.id, label: item.label }))}
                    onChange={({ value }) => setSignalEditor({ ...signalEditor, machine: value || '', pointId: '', endpoint: '' })} />
                </Field>
                <Field label="Még fel nem használt adatpont" htmlFor="new-signal-point">
                  <Combobox id="new-signal-point" value={signalEditor.pointId || null} placeholder="Válassz adatpontot"
                    options={availableMachineItems.map((item) => ({ value: item.id, label: `${item.path}${item.units ? ` (${item.units})` : ''}` }))}
                    onChange={({ value }) => {
                      const item = machineItems.find((entry) => entry.id === value);
                      setSignalEditor({ ...signalEditor, pointId: value || '', endpoint: item?.path || '',
                        units: item?.units || '', id: signalEditor.id || suggestId(item?.path || ''),
                        name: signalEditor.name || (item ? suggestName(item) : '') });
                    }} />
                </Field>
              </>
            )}
            <Field label="Jelazonosító" htmlFor="signal-id" description={signalEditor.originalId ? 'Létrehozás után az azonosító nem módosítható.' : 'Egyedi, gépileg használható azonosító.'}>
              <Input id="signal-id" value={signalEditor.id} disabled={!!signalEditor.originalId}
                onChange={(event) => setSignalEditor({ ...signalEditor, id: event.currentTarget.value })} />
            </Field>
            <Field label="Magyar elnevezés" htmlFor="signal-name" invalid={submitted && !signalEditor.name.trim()}
              error={submitted && !signalEditor.name.trim() ? 'Adj nevet a jelnek.' : undefined}>
              <Input id="signal-name" value={signalEditor.name} maxLength={120}
                onChange={(event) => setSignalEditor({ ...signalEditor, name: event.currentTarget.value })} />
            </Field>
            <Field label="Mértékegység" htmlFor="signal-units" description="A gépből választott adatpont egysége előre kitölti ezt a mezőt.">
              <Input id="signal-units" value={signalEditor.units} maxLength={80}
                onChange={(event) => setSignalEditor({ ...signalEditor, units: event.currentTarget.value })} />
            </Field>
            <Modal.ButtonRow>
              <Button type="button" variant="secondary" onClick={() => setSignalEditor(undefined)}>Mégse</Button>
              <Button type="button" disabled={saving || !signalEditor.name.trim() || !signalEditor.id.trim() ||
                (signalEditor.mode === 'machine' && (!signalEditor.endpoint || !selectedSchema))} onClick={saveSignal}>
                Mentés
              </Button>
            </Modal.ButtonRow>
          </div>
        </Modal>
      )}

      {schemaEditor && (
        <Modal title={schemaEditor.id ? 'Séma átnevezése' : 'Séma hozzáadása'} isOpen onDismiss={() => setSchemaEditor(undefined)}>
          <div className={styles.schemaModalFields}>
            <Field label="Séma neve" htmlFor="schema-name" invalid={submitted && !schemaEditor.name.trim()}
              error={submitted && !schemaEditor.name.trim() ? 'Adj nevet a sémának.' : undefined}>
              <Input id="schema-name" autoFocus value={schemaEditor.name} maxLength={120}
                onChange={(event) => setSchemaEditor({ ...schemaEditor, name: event.currentTarget.value })} />
            </Field>
            <Modal.ButtonRow>
              <Button type="button" variant="secondary" onClick={() => setSchemaEditor(undefined)}>Mégse</Button>
              <Button type="button" disabled={saving || !schemaEditor.name.trim()} onClick={saveSchema}>Mentés</Button>
            </Modal.ButtonRow>
          </div>
        </Modal>
      )}

      {mappingEditor && mappingSignal && (
        <Modal title={`${mappingSignal.name} hozzárendelése`} isOpen onDismiss={() => setMappingEditor(undefined)}>
          <div className={styles.schemaModalFields}>
            <Field label="Hozzárendelés módja" htmlFor="mapping-source">
              <Combobox id="mapping-source" value={mappingEditor.source} options={[
                { value: 'manual', label: 'Útvonal kézi megadása' },
                { value: 'machine', label: 'Kiválasztás egy gép adatpontjai közül' },
              ]} onChange={({ value }) => setMappingEditor({ ...mappingEditor, source: value,
                machine: '', endpoint: value === 'manual' ? mappingEditor.endpoint : '' })} />
            </Field>
            {mappingEditor.source === 'machine' && (
              <>
                <Field label="Gép" htmlFor="mapping-machine">
                  <Combobox id="mapping-machine" value={mappingEditor.machine || null} placeholder="Válassz gépet"
                    options={machines.map((item) => ({ value: item.id, label: item.label }))}
                    onChange={({ value }) => setMappingEditor({ ...mappingEditor, machine: value || '', endpoint: '' })} />
                </Field>
                <Field label="A sémában még nem használt adatpont" htmlFor="mapping-endpoint-select">
                  <Combobox id="mapping-endpoint-select" value={mappingEditor.endpoint || null} placeholder="Válassz adatpontot"
                    options={availableMachineItems.map((item) => ({ value: item.path, label: `${item.path}${item.units ? ` (${item.units})` : ''}` }))}
                    onChange={({ value }) => setMappingEditor({ ...mappingEditor, endpoint: value || '' })} />
                </Field>
                <Field label="A jel mentett mértékegysége" htmlFor="mapping-signal-units">
                  <Input id="mapping-signal-units" value={mappingSignal.units || 'Nincs megadva'} disabled />
                </Field>
                {unitMismatch && <Alert severity="warning" title="Eltérő mértékegység">
                  A jel mentett egysége „{mappingSignal.units || 'nincs megadva'}”, a gépadatpont egysége „{selectedDataItem?.units || 'nincs megadva'}”. A jel mentett egysége nem változik; érdemes lehet külön jelet felvenni.
                </Alert>}
              </>
            )}
            {mappingEditor.source === 'manual' && (
              <Field label="Gépen belüli végpont" htmlFor="mapping-endpoint" description="A gépnév és agentnév nélkül, / jellel kezdődő útvonalat adj meg.">
                <Input id="mapping-endpoint" value={mappingEditor.endpoint} placeholder="/Axes/Linear[X]/Position"
                  onChange={(event) => setMappingEditor({ ...mappingEditor, endpoint: event.currentTarget.value })} />
              </Field>
            )}
            <Modal.ButtonRow>
              <Button type="button" variant="secondary" onClick={() => setMappingEditor(undefined)}>Mégse</Button>
              <Button type="button" disabled={saving || !mappingEditor.endpoint.trim() ||
                (mappingEditor.source === 'machine' && !mappingEditor.machine)} onClick={saveMapping}>Hozzárendelés mentése</Button>
            </Modal.ButtonRow>
          </div>
        </Modal>
      )}

      {deleteSignal && <ConfirmModal isOpen title={`${deleteSignal.name} törlése`}
        body="A katalógusjel nem törölhető, ha valamelyik séma vagy dashboard használja."
        confirmText="Jel törlése" dismissText="Mégse" confirmVariant="destructive" disabled={saving}
        onConfirm={removeSignal} onDismiss={() => setDeleteSignal(undefined)} />}
      {deleteSchema && <ConfirmModal isOpen title={`${deleteSchema.name} törlése`}
        body="A séma hozzárendelései törlődnek. Géphez rendelt séma nem törölhető."
        confirmText="Séma törlése" dismissText="Mégse" confirmVariant="destructive" disabled={saving}
        onConfirm={removeSchema} onDismiss={() => setDeleteSchema(undefined)} />}
    </>
  );
}
