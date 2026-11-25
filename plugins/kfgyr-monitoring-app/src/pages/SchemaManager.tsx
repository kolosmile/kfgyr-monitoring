import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Badge, Button, Checkbox, Combobox, ConfirmModal, Field, Icon, IconButton, Input, Modal, Spinner, Tooltip, useStyles2 } from '@grafana/ui';
import { api } from '../api';
import { getStyles } from '../components/styles';
import { errorText, SchemaOption, Signal } from '../types';
import { DisplayUnitsSettings } from './DisplayUnitsSettings';

type Machine = { id: string; label: string; schema_id?: string };
type DataItem = { id: string; path: string; name?: string; units: string; category: string; type: string; subType: string };
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
type SchemaEditor = { id?: string; name: string; sourceSchemaId?: string };
type MappingEditor = { signalId: string; source: 'manual' | 'machine'; machine: string; endpoint: string };
const emptyMappings: Mapping[] = [];
const missingMappingText = 'Az adatpont-hozzárendelés ezen a gépen nem oldható fel. Módosítsd, vagy hozz létre új sémát.';

function useMachineDataItems(machine: string) {
  const [state, setState] = useState<{ machine: string; items?: DataItem[]; error?: string }>();
  useEffect(() => {
    if (!machine) {
      return;
    }
    let active = true;
    setState({ machine });
    api<{ dataitems: DataItem[] }>(`machines/${encodeURIComponent(machine)}/dataitems`)
      .then(({ dataitems }) => active && setState({ machine, items: dataitems }))
      .catch((err) => active && setState({ machine, error: errorText(err) }));
    return () => { active = false; };
  }, [machine]);
  return machine && state?.machine === machine ? state : undefined;
}

function dataItemLabel(item: DataItem) {
  return [item.path, item.name?.trim(), item.units].filter(Boolean).join(' · ');
}

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

export function SchemaManager({ machine }: { machine?: string }) {
  const styles = useStyles2(getStyles);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [schemas, setSchemas] = useState<SchemaOption[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [selectedSchema, setSelectedSchema] = useState('');
  const [signalQuery, setSignalQuery] = useState('');
  const [endpointQuery, setEndpointQuery] = useState('');
  const [displayUnitLabels, setDisplayUnitLabels] = useState(new Map<string, string>());
  const [mappingState, setMappingState] = useState<MappingState>();
  const [checkingMachine, setCheckingMachine] = useState(machine ?? '');
  const [differencesOnly, setDifferencesOnly] = useState(false);
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

  async function loadBase(preferredSchema?: string) {
    const [catalog, schemaResult, machineResult] = await Promise.all([
      api<CatalogResponse>('signals'),
      api<SchemaResponse>('schemas'),
      api<MachinesResponse>('machines'),
    ]);
    setSignals(catalog.signals);
    setSchemas(schemaResult.schemas);
    setMachines(machineResult.machines);
    const schemaId = preferredSchema ?? machineResult.machines.find((item) => item.id === machine)?.schema_id;
    const nextSchema = schemaResult.schemas.find((item) => item.id === schemaId)?.id
      ?? schemaResult.schemas[0]?.id ?? '';
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
        const schemaId = await loadBase();
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
  const check = useMachineDataItems(checkingMachine);
  const otherItems = useMachineDataItems(activeMachine !== checkingMachine ? activeMachine : '');
  const picker = activeMachine && activeMachine === checkingMachine ? check : otherItems;
  const machineItems = picker?.items ?? [];

  const schema = schemas.find((item) => item.id === selectedSchema);
  const currentMappingState = mappingState?.schemaId === selectedSchema ? mappingState : undefined;
  const mappings = currentMappingState?.mappings ?? emptyMappings;
  const mappingsReady = Boolean(currentMappingState?.mappings);
  const mappingBySignal = useMemo(() => new Map(mappings.map((item) => [item.signal_id, item])), [mappings]);
  const checkedPaths = useMemo(() => check?.items && new Set(check.items.map((item) => item.path)), [check?.items]);
  const assignedMappings = mappings.filter((item) => item.endpoint);
  const missing = new Set(checkedPaths
    ? assignedMappings.filter((item) => !checkedPaths.has(item.endpoint!)).map((item) => item.signal_id)
    : []);
  const machinePriority = (item: Machine) => item.id === checkingMachine ? 0 : item.schema_id === selectedSchema ? 1 : 2;
  const machineOptions = [...machines]
    .sort((left, right) => machinePriority(left) - machinePriority(right))
    .map(({ id, label }) => ({ value: id, label }));
  const signalSearch = signalQuery.trim().toLocaleLowerCase('hu');
  const endpointSearch = mappingsReady ? endpointQuery.trim().toLocaleLowerCase('hu') : '';
  const visibleSignals = signals.filter((signal) => {
    const signalText = `${signal.name} ${signal.id} ${signal.units} ${displayUnitLabels.get(signal.units) ?? ''}`.toLocaleLowerCase('hu');
    const endpoint = mappingBySignal.get(signal.id)?.endpoint ?? '';
    return signalText.includes(signalSearch) && endpoint.toLocaleLowerCase('hu').includes(endpointSearch)
      && (!differencesOnly || !checkedPaths || !mappingsReady || missing.has(signal.id));
  });
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
        const result = await api<{ schema: SchemaOption }>('schemas', 'POST', {
          name: schemaEditor.name.trim(),
          source_schema_id: schemaEditor.sourceSchemaId || undefined,
        });
        preferredSchema = result.schema.id;
      }
      setSchemaEditor(undefined);
      await reload(preferredSchema);
      setNotice(schemaEditor.sourceSchemaId ? 'A séma és a hozzárendelései másolva.' : 'A séma mentése sikerült.');
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
    const endpoint = mappingBySignal.get(signalId)?.endpoint || '';
    const source = endpoint && !checkingMachine ? 'manual' : 'machine';
    setMappingEditor({
      signalId, source, machine: checkingMachine,
      endpoint: source === 'manual' || checkedPaths?.has(endpoint) ? endpoint : '',
    });
  }

  function openSignalEditor(mode: SignalEditor['mode'], signal?: Signal) {
    setSubmitted(false);
    setSignalEditor({
      mode, originalId: signal?.id, id: signal?.id ?? '', name: signal?.name ?? '', units: signal?.units ?? '',
      machine: mode === 'machine' ? checkingMachine : '', pointId: '', endpoint: '',
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
      {error && !schemaEditor && <Alert severity="error" title="A művelet sikertelen">{error}</Alert>}
      {notice && <Alert severity="success" title={notice} />}
      <div className={styles.schemaColumns}>
        <section className={styles.formCard}>
          <div className={styles.schemaScroll} role="region" aria-label="Jelek és adatpontok" tabIndex={0}>
            <table className={styles.schemaTable} aria-label="Jelek és a sémához rendelt adatpontok">
              <colgroup><col /><col className={styles.schemaConnectorColumn} /><col /></colgroup>
              <thead>
                <tr>
                  <th scope="col">
                    Jelek
                    <Input className={styles.schemaSearch} aria-label="Jelek keresése" placeholder="Jel keresése…"
                      prefix={<Icon name="search" />} value={signalQuery}
                      onChange={(event) => setSignalQuery(event.currentTarget.value)} />
                  </th>
                  <td aria-hidden />
                  <th scope="col">
                    Adatpontok
                    <Input className={styles.schemaSearch} aria-label="Adatpontok keresése" placeholder="Adatpont keresése…"
                      prefix={<Icon name="search" />} value={endpointQuery}
                      onChange={(event) => setEndpointQuery(event.currentTarget.value)} />
                  </th>
                </tr>
                <tr className={styles.schemaAddRows}>
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
              </thead>
              <tbody className={styles.schemaRows} aria-busy={Boolean(schema && !mappingsReady && !currentMappingState?.failed)}>
                {visibleSignals.map((signal) => {
                  const mapping = mappingBySignal.get(signal.id);
                  const displayUnit = displayUnitLabels.get(signal.units);
                  const signalDetails = displayUnit ? signal.id : `${signal.id} · ${signal.units || 'Nincs megadott egység'}`;
                  return (
                    <tr key={signal.id} className={`${styles.mtconnectBranchClass(mapping?.endpoint)} ${missing.has(signal.id) ? styles.schemaMissingRow : ''}`}>
                      <th scope="row">
                        <div className={styles.schemaCell}>
                          <div className={styles.schemaRowText}>
                            <strong className={`${styles.schemaTruncated} ${styles.schemaSignalName}`}
                              title={signal.name}>{signal.name}</strong>
                            <small className={styles.schemaTruncated} title={signalDetails}>{signalDetails}</small>
                          </div>
                          <div className={styles.schemaActions}>
                            {displayUnit && <Badge color="blue" tooltip={`${displayUnit} · ${signal.units}`}
                              text={<span className={styles.displayUnitBadgeText}>{displayUnit}</span>} />}
                            <IconButton type="button" name="pen" aria-label={`${signal.name} módosítása`}
                              tooltip="Jel módosítása" disabled={saving} onClick={() => openSignalEditor('catalog', signal)} />
                            <IconButton type="button" variant="destructive" name="trash-alt"
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
                            <span className={`${styles.schemaPath} ${styles.schemaTruncated}`} title={mapping.endpoint}>
                              {mapping.endpoint}
                            </span>
                            <div className={styles.schemaActions}>
                              {missing.has(signal.id) && (
                                <Tooltip content={missingMappingText}>
                                  <span className={styles.schemaMissingIcon} tabIndex={0} role="img" aria-label={missingMappingText}>
                                    <Icon name="exclamation-circle" aria-hidden size="sm" />
                                  </span>
                                </Tooltip>
                              )}
                              <IconButton type="button" name="pen" tooltip="Hozzárendelés módosítása"
                                aria-label={`${signal.name} hozzárendelésének módosítása`} disabled={saving}
                                onClick={() => openMapping(signal.id)} />
                              <IconButton type="button" variant="destructive" name="trash-alt"
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
                {!visibleSignals.length && (
                  <tr><td colSpan={3} className={styles.muted}>
                    {differencesOnly && checkedPaths && !missing.size ? 'Nincs eltérő hozzárendelés ezen a gépen.'
                      : signals.length ? 'Nincs a keresésnek megfelelő találat.' : 'A jelkatalógus még üres.'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className={styles.schemaSidebar}>
          <section className={`${styles.formCard} ${styles.schemaSettings}`} aria-labelledby="schema-settings-title">
            <div className={styles.schemaSettingsHeader}>
              <h3 id="schema-settings-title">Sémák</h3>
              <Button type="button" size="sm" icon="plus" disabled={saving} onClick={() => {
                setSubmitted(false);
                setError('');
                setSchemaEditor({ name: '' });
              }}>Új séma</Button>
            </div>
            <Field label="Aktív séma" htmlFor="schema-select" noMargin>
              <Combobox id="schema-select" value={selectedSchema || null} disabled={saving}
                placeholder="Válassz sémát" options={schemas.map((item) => ({ value: item.id, label: item.name }))}
                onChange={async ({ value }) => {
                  setSelectedSchema(value || '');
                  setError('');
                  setNotice('');
                  try { await loadMappings(value || ''); } catch (err) { setError(errorText(err)); }
                }} />
            </Field>
            {mappingsReady && <p className={styles.muted} role="status">{assignedMappings.length}/{signals.length} jelhez van adatpont rendelve</p>}
            {schema && (
              <div className={styles.schemaSettingsActions}>
                <Button type="button" size="sm" variant="secondary" icon="pen" disabled={saving}
                  onClick={() => {
                    setSubmitted(false);
                    setError('');
                    setSchemaEditor({ id: schema.id, name: schema.name });
                  }}>Átnevezés</Button>
                <Button type="button" size="sm" variant="destructive" fill="outline" icon="trash-alt" disabled={saving}
                  onClick={() => setDeleteSchema(schema)}>Törlés</Button>
              </div>
            )}
            {!schemas.length && <p className={styles.muted}>Hozz létre sémát a hozzárendelésekhez.</p>}
            {schema && !mappingsReady && !currentMappingState?.failed &&
              <p className={styles.muted} role="status"><Spinner /> Adatpontok betöltése…</p>}
          </section>
          <section className={`${styles.formCard} ${styles.schemaSettings}`} aria-labelledby="schema-check-title">
            <div className={styles.schemaSettingsHeader}><h3 id="schema-check-title">Ellenőrzés gépen</h3></div>
            <Field label="Gép" htmlFor="schema-check-machine" noMargin>
              <Combobox id="schema-check-machine" value={checkingMachine || null} placeholder="Válassz gépet"
                isClearable options={machineOptions} onChange={(option) => setCheckingMachine(option?.value ?? '')} />
            </Field>
            {check?.error && <Alert severity="error" title="A gép adatpontlistája nem érhető el">{check.error}</Alert>}
            {checkingMachine && !check?.items && !check?.error &&
              <p className={styles.muted} role="status"><Spinner /> A gép adatpontjainak betöltése…</p>}
            {checkedPaths && mappingsReady && (
              <>
                <p className={styles.muted} role="status">{assignedMappings.length - missing.size}/{assignedMappings.length} hozzárendelt adatpont feloldható</p>
                <Checkbox label="Csak az eltérések" value={differencesOnly}
                  onChange={(event) => setDifferencesOnly(event.currentTarget.checked)} />
              </>
            )}
          </section>
          <DisplayUnitsSettings onChange={setDisplayUnitLabels} />
        </div>
      </div>

      {signalEditor && (
        <Modal title={signalEditor.originalId ? 'Jel módosítása' : signalEditor.mode === 'machine' ? 'Új jel gépadatpontból' : 'Jel hozzáadása'}
          isOpen onDismiss={() => setSignalEditor(undefined)}>
          <div className={styles.schemaModalFields}>
            {signalEditor.mode === 'machine' && (
              <>
                <Field label="Gép" htmlFor="new-signal-machine">
                  <Combobox id="new-signal-machine" value={signalEditor.machine || null} placeholder="Válassz gépet"
                    options={machineOptions}
                    onChange={({ value }) => setSignalEditor({ ...signalEditor, machine: value || '', pointId: '', endpoint: '' })} />
                </Field>
                <Field label="Még fel nem használt adatpont" htmlFor="new-signal-point">
                  <Combobox id="new-signal-point" value={signalEditor.pointId || null} placeholder="Válassz adatpontot"
                    loading={!!activeMachine && !picker?.items && !picker?.error}
                    options={availableMachineItems.map((item) => ({ value: item.id, label: dataItemLabel(item) }))}
                    onChange={({ value }) => {
                      const item = machineItems.find((entry) => entry.id === value);
                      setSignalEditor({ ...signalEditor, pointId: value || '', endpoint: item?.path || '',
                        units: item?.units || '', id: signalEditor.id || suggestId(item?.path || ''),
                        name: signalEditor.name || (item ? suggestName(item) : '') });
                    }} />
                </Field>
                {picker?.error && <Alert severity="error" title="A gép adatpontlistája nem érhető el">{picker.error}</Alert>}
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
        <Modal title={schemaEditor.id ? 'Séma átnevezése' : 'Séma hozzáadása'} isOpen
          onDismiss={() => { if (!saving) { setSchemaEditor(undefined); setError(''); } }}>
          <div className={styles.schemaModalFields}>
            {error && <Alert severity="error" title="A séma nem menthető">{error}</Alert>}
            <Field label="Séma neve" htmlFor="schema-name" invalid={submitted && !schemaEditor.name.trim()}
              error={submitted && !schemaEditor.name.trim() ? 'Adj nevet a sémának.' : undefined}>
              <Input id="schema-name" autoFocus value={schemaEditor.name} maxLength={120}
                onChange={(event) => setSchemaEditor({ ...schemaEditor, name: event.currentTarget.value })} />
            </Field>
            {!schemaEditor.id && (
              <Field label="Kiindulás" htmlFor="new-schema-source">
                <Combobox id="new-schema-source" value={schemaEditor.sourceSchemaId ?? ''} isClearable={false}
                  disabled={saving}
                  options={[{ value: '', label: 'Új, üres séma' }, ...schemas.map((item) => ({
                    value: item.id, label: item.name,
                  }))]}
                  onChange={({ value }) => setSchemaEditor({ ...schemaEditor, sourceSchemaId: value })} />
              </Field>
            )}
            <Modal.ButtonRow>
              <Button type="button" variant="secondary" disabled={saving}
                onClick={() => { setSchemaEditor(undefined); setError(''); }}>Mégse</Button>
              <Button type="button" disabled={saving || !schemaEditor.name.trim()} onClick={saveSchema}>
                {schemaEditor.id ? 'Mentés' : 'Létrehozás'}
              </Button>
            </Modal.ButtonRow>
          </div>
        </Modal>
      )}

      {mappingEditor && mappingSignal && (
        <Modal title={`${mappingSignal.name} hozzárendelése`} isOpen onDismiss={() => setMappingEditor(undefined)}>
          <div className={styles.schemaModalFields}>
            <Field label="Hozzárendelés módja" htmlFor="mapping-source">
              <Combobox id="mapping-source" value={mappingEditor.source} options={[
                { value: 'machine', label: 'Kiválasztás egy gép adatpontjai közül' },
                { value: 'manual', label: 'Útvonal kézi megadása' },
              ]} onChange={({ value }) => setMappingEditor({ ...mappingEditor, source: value,
                machine: value === 'machine' ? checkingMachine : '', endpoint: mappingEditor.endpoint })} />
            </Field>
            {mappingEditor.source === 'machine' && (
              <>
                <Field label="Gép" htmlFor="mapping-machine">
                  <Combobox id="mapping-machine" value={mappingEditor.machine || null} placeholder="Válassz gépet"
                    options={machineOptions}
                    onChange={({ value }) => setMappingEditor({ ...mappingEditor, machine: value || '', endpoint: '' })} />
                </Field>
                <Field label="A sémában még nem használt adatpont" htmlFor="mapping-endpoint-select">
                  <Combobox id="mapping-endpoint-select" value={mappingEditor.endpoint || null} placeholder="Válassz adatpontot"
                    loading={!!activeMachine && !picker?.items && !picker?.error}
                    options={availableMachineItems.map((item) => ({ value: item.path, label: dataItemLabel(item) }))}
                    onChange={({ value }) => setMappingEditor({ ...mappingEditor, endpoint: value || '' })} />
                </Field>
                {picker?.error && <Alert severity="error" title="A gép adatpontlistája nem érhető el">{picker.error}</Alert>}
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
                (mappingEditor.source === 'machine' && !selectedDataItem)} onClick={saveMapping}>Hozzárendelés mentése</Button>
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
