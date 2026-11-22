import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Combobox, ConfirmModal, Field, Icon, Input, Modal, Spinner, useStyles2 } from '@grafana/ui';
import { api } from '../api';
import { getStyles } from '../components/styles';
import { errorText, SchemaOption, Signal } from '../types';

type Machine = { id: string; label: string; schema_id?: string };
type DataItem = { id: string; path: string; units: string; category: string; type: string; subType: string };
type Mapping = { signal_id: string; signal_name: string; signal_units: string; endpoint: string | null };
type MappingResponse = { mappings: Mapping[] };
type MappingState = { schemaId: string; mappings?: Mapping[]; failed?: boolean };
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
const emptyMappings: Mapping[] = [];

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
  const [mappingState, setMappingState] = useState<MappingState>();
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
  const [deleteMapping, setDeleteMapping] = useState<{ schema: SchemaOption; mapping: Mapping }>();
  const [submitted, setSubmitted] = useState(false);
  const mappingRequest = useRef(0);

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
    const request = ++mappingRequest.current;
    setMappingState({ schemaId });
    if (!schemaId) {
      return;
    }
    try {
      const result = await api<MappingResponse>(`schemas/${encodeURIComponent(schemaId)}/mappings`);
      if (request === mappingRequest.current) {
        setMappingState({ schemaId, mappings: result.mappings });
      }
    } catch (err) {
      if (request === mappingRequest.current) {
        setMappingState({ schemaId, failed: true });
        throw err;
      }
    }
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

  const schema = schemas.find((item) => item.id === selectedSchema);
  const currentMappingState = mappingState?.schemaId === selectedSchema ? mappingState : undefined;
  const mappings = currentMappingState?.mappings ?? emptyMappings;
  const mappingsReady = Boolean(currentMappingState?.mappings);
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
      await reload(selectedSchema).catch(() => undefined);
      setError(errorText(err));
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

  async function removeMapping() {
    if (!deleteMapping || saving) {
      return;
    }
    const { schema, mapping } = deleteMapping;
    setSaving(true);
    setError('');
    try {
      await api(`schemas/${encodeURIComponent(schema.id)}/mappings/${encodeURIComponent(mapping.signal_id)}`, 'DELETE');
      setNotice('A hozzárendelés törölve; a jel a katalógusban megmaradt.');
      await reload(schema.id);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setDeleteMapping(undefined);
      setSaving(false);
    }
  }

  function openMapping(signalId: string) {
    const current = mappingBySignal.get(signalId);
    setMappingEditor({ signalId, source: 'manual', machine: '', endpoint: current?.endpoint || '' });
  }

  function openSignalEditor(mode: SignalEditor['mode'], signal?: Signal) {
    setSubmitted(false);
    setSignalEditor({
      mode, originalId: signal?.id, id: signal?.id ?? '', name: signal?.name ?? '', units: signal?.units ?? '',
      machine: '', pointId: '', endpoint: '',
    });
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
        <section className={styles.formCard} aria-label="Jelek és adatpontok">
          <table className={styles.schemaTable} aria-label="Jelek és a sémához rendelt adatpontok">
            <colgroup><col /><col className={styles.schemaConnectorColumn} /><col /></colgroup>
            <thead>
              <tr><th scope="col">Jelek</th><td aria-hidden /><th scope="col">Adatpontok</th></tr>
            </thead>
            <tbody className={styles.schemaAddRows}>
              <tr>
                <td>
                  <button type="button" className={styles.schemaAdd} disabled={saving}
                    onClick={() => openSignalEditor('catalog')}>
                    <Icon name="plus" aria-hidden /> Jel hozzáadása
                  </button>
                </td>
                <td aria-hidden />
                <td>
                  <button type="button" className={styles.schemaAdd} disabled={saving || !mappingsReady}
                    onClick={() => openSignalEditor('machine')}>
                    <Icon name="plus" aria-hidden /> Új jel gépadatpontból
                  </button>
                </td>
              </tr>
            </tbody>
            <tbody className={styles.schemaRows} aria-busy={Boolean(schema && !mappingsReady && !currentMappingState?.failed)}>
              {signals.map((signal) => {
                const mapping = mappingBySignal.get(signal.id);
                return (
                  <tr key={signal.id}>
                    <th scope="row">
                      <div className={styles.schemaCell}>
                        <div className={styles.schemaRowText}>
                          <strong>{signal.name}</strong>
                          <small>{signal.id} · {signal.units || 'Nincs megadott egység'}</small>
                        </div>
                        <div className={styles.schemaActions}>
                          <Button type="button" size="sm" variant="secondary" icon="pen" aria-label={`${signal.name} módosítása`}
                            tooltip="Jel módosítása" disabled={saving} onClick={() => openSignalEditor('catalog', signal)} />
                          <Button type="button" size="sm" variant="destructive" fill="outline" icon="trash-alt"
                            aria-label={`${signal.name} törlése`} tooltip="Jel törlése" disabled={saving} onClick={() => setDeleteSignal(signal)} />
                        </div>
                      </div>
                    </th>
                    <td className={styles.schemaConnector} aria-hidden>
                      {mapping?.endpoint && <Icon name="arrow-right" size="sm" />}
                    </td>
                    <td>
                      {mapping?.endpoint && schema ? (
                        <div className={styles.schemaCell}>
                          <code className={styles.schemaPath}>{mapping.endpoint}</code>
                          <div className={styles.schemaActions}>
                            <Button type="button" size="sm" variant="secondary" icon="pen" tooltip="Hozzárendelés módosítása"
                              aria-label={`${signal.name} hozzárendelésének módosítása`} disabled={saving}
                              onClick={() => openMapping(signal.id)} />
                            <Button type="button" size="sm" variant="destructive" fill="outline" icon="trash-alt"
                              aria-label={`${signal.name} hozzárendelésének törlése`} tooltip="Hozzárendelés törlése"
                              disabled={saving} onClick={() => setDeleteMapping({ schema, mapping })} />
                          </div>
                        </div>
                      ) : mappingsReady ? (
                        <button type="button" className={styles.schemaAdd} disabled={saving}
                          aria-label={`${signal.name} adatpontjának hozzárendelése`} onClick={() => openMapping(signal.id)}>
                          <Icon name="plus" aria-hidden /> Adatpont hozzárendelése
                        </button>
                      ) : <span aria-label="Az adatpont nem jeleníthető meg">–</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!signals.length && <p className={styles.muted}>A jelkatalógus még üres.</p>}
        </section>

        <section className={`${styles.formCard} ${styles.schemaSettings}`} aria-labelledby="schema-settings-title">
          <h3 id="schema-settings-title">Sémák</h3>
          <Field label="Aktív séma" htmlFor="schema-select">
            <Combobox id="schema-select" value={selectedSchema || null} disabled={saving}
              placeholder="Válassz sémát" options={schemas.map((item) => ({ value: item.id, label: item.name }))}
              onChange={async ({ value }) => {
                setSelectedSchema(value || '');
                setError('');
                setNotice('');
                try { await loadMappings(value || ''); } catch (err) { setError(errorText(err)); }
              }} />
          </Field>
          <div className={styles.schemaActions}>
            <Button type="button" icon="plus" disabled={saving} onClick={() => {
              setSubmitted(false);
              setSchemaEditor({ name: '' });
            }}>Új séma</Button>
            {schema && (
              <>
                <Button type="button" variant="secondary" icon="pen" disabled={saving}
                  onClick={() => {
                    setSubmitted(false);
                    setSchemaEditor({ id: schema.id, name: schema.name });
                  }}>Átnevezés</Button>
                <Button type="button" variant="destructive" fill="outline" icon="trash-alt" disabled={saving}
                  onClick={() => setDeleteSchema(schema)}>Törlés</Button>
              </>
            )}
          </div>
          {!schemas.length && <p className={styles.muted}>Hozz létre sémát a hozzárendelésekhez.</p>}
          {schema && !mappingsReady && !currentMappingState?.failed &&
            <p className={styles.muted} role="status"><Spinner /> Adatpontok betöltése…</p>}
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
        modalClass={styles.deleteConfirmation}
        body="A katalógusjel nem törölhető, ha valamelyik séma vagy dashboard használja."
        confirmText="Jel törlése" dismissText="Mégse" confirmVariant="destructive" disabled={saving}
        onConfirm={removeSignal} onDismiss={() => setDeleteSignal(undefined)} />}
      {deleteSchema && <ConfirmModal isOpen title={`${deleteSchema.name} törlése`}
        modalClass={styles.deleteConfirmation}
        body="A séma hozzárendelései törlődnek. Géphez rendelt séma nem törölhető."
        confirmText="Séma törlése" dismissText="Mégse" confirmVariant="destructive" disabled={saving}
        onConfirm={removeSchema} onDismiss={() => setDeleteSchema(undefined)} />}
      {deleteMapping && <ConfirmModal isOpen title="Hozzárendelés törlése"
        modalClass={styles.deleteConfirmation}
        body={`A „${deleteMapping.mapping.signal_name}” jel végpontja törlődik a „${deleteMapping.schema.name}” sémából. A jel a katalógusban megmarad.`}
        confirmText="Hozzárendelés törlése" dismissText="Mégse" confirmVariant="destructive" disabled={saving}
        onConfirm={removeMapping} onDismiss={() => setDeleteMapping(undefined)} />}
    </>
  );
}
