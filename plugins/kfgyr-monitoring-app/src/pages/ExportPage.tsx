import React, { useEffect, useState } from 'react';
import { config, getBackendSrv, PluginPage } from '@grafana/runtime';
import { Alert, Badge, Button, Combobox, Field, Input, MultiCombobox, useStyles2 } from '@grafana/ui';
import { lastValueFrom } from 'rxjs';
import { getStyles } from '../components/styles';
import { errorText } from '../types';

type Option = { id: string; label: string };
type Cell = string | number | boolean | null;
type Frame = { schema: { fields: Array<{ name: string }> }; data: { values: Cell[][] } };
const datasource = { uid: 'timescaledb', type: 'grafana-postgresql-datasource' };
const devices = "SELECT node_id::text, props->>'path' FROM raw.nodes WHERE props->>'node_type'='Device' ORDER BY 2";
const literal = (value: string) => "'" + value.replace(/'/g, "''") + "'";
const ids = (values: string[]) => values.map(literal).join(', ');

async function query(sql: string) {
  const response = await lastValueFrom(getBackendSrv().fetch<{ results: { A?: { error?: string; frames?: Frame[] } } }>({
    url: '/api/ds/query',
    method: 'POST',
    data: { from: String(Date.now() - 3600000), to: String(Date.now()), queries: [{ datasource, refId: 'A', rawSql: sql, rawQuery: true, format: 'table', editorMode: 'code' }] },
    showErrorAlert: false,
  }));
  const result = response.data.results.A;
  if (!result || result.error || !result.frames?.[0]) {
    throw new Error(result?.error || 'Az adatforrás nem adott táblázatos választ.');
  }
  return result.frames[0];
}

async function options(sql: string): Promise<Option[]> {
  const frame = await query(sql);
  return frame.data.values[0].map((id, index) => ({ id: String(id), label: String(frame.data.values[1][index]) }));
}

function localDate(value: number) {
  const date = new Date(value);
  return new Date(value - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function csvCell(value: Cell, delimiter: string) {
  let content = String(value ?? '');
  if (/^[\s\u0000-\u001f]*[=+@-]|^[\t\r\n]/.test(content) &&
      !/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(content)) {
    content = "'" + content;
  }
  return content.includes(delimiter) || /["\r\n]/.test(content) ? '"' + content.replace(/"/g, '""') + '"' : content;
}

export function ExportPage() {
  const styles = useStyles2(getStyles);
  const [loadingMachines, setLoadingMachines] = useState(true);
  const [machines, setMachines] = useState<Option[]>([]);
  const [machine, setMachine] = useState<string[]>([]);
  const [signals, setSignals] = useState<Option[]>([]);
  const [signal, setSignal] = useState<string[]>([]);
  const [from, setFrom] = useState(() => localDate(Date.now() - 3600000));
  const [to, setTo] = useState(() => localDate(Date.now() + 60000));
  const [limit, setLimit] = useState(10000);
  const [format, setFormat] = useState('csv');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingSignals, setLoadingSignals] = useState(false);

  useEffect(() => {
    let active = true;
    options(devices)
      .then((items) => active && setMachines(items))
      .catch((err) => active && setError(errorText(err)))
      .finally(() => active && setLoadingMachines(false));
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!machine.length) {
      return;
    }
    let active = true;
    setLoadingSignals(true);
    options(`SELECT DISTINCT n.node_id::text, n.props->>'path'
      FROM raw.nodes n JOIN raw.nodes d ON d.props->>'node_type'='Device'
      AND d.props->>'agentAlias'=n.props->>'agentAlias' AND d.props->>'deviceId'=n.props->>'deviceId'
      WHERE n.props->>'node_type'='DataItem' AND d.node_id::text IN (${ids(machine)}) ORDER BY 2`)
      .then((items) => {
        if (active) {
          setSignals(items);
          const available = new Set(items.map(({ id }) => id));
          setSignal((previous) => previous.filter((id) => available.has(id)));
        }
      })
      .catch((err) => active && setError(errorText(err)))
      .finally(() => active && setLoadingSignals(false));
    return () => { active = false; };
  }, [machine]);

  async function download(event: React.FormEvent) {
    event.preventDefault();
    setStatus('');
    setError('');
    const start = new Date(from);
    const end = new Date(to);
    if (!Number.isFinite(+start) || !Number.isFinite(+end) || start >= end) {
      setError('Adj meg érvényes kezdő- és végidőt.');
      return;
    }
    if (!machine.length || !signal.length || ![1000, 10000, 50000, 100000].includes(limit)) {
      return;
    }
    setBusy(true);
    try {
      const frame = await query(`SELECT
        to_char(h.time AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "Időpont (UTC)",
        d.props->>'path' AS "Gép", n.props->>'path' AS "Adatpont",
        n.props->>'id' AS "MTConnect adatpontazonosító", n.props->>'category' AS "Kategória",
        n.props->>'type' AS "Típus", n.props->>'units' AS "Mértékegység", h.value #>> '{}' AS "Érték"
        FROM raw.history h JOIN raw.nodes d ON d.node_id=h.node_id
        JOIN raw.nodes n ON n.node_id=h.dataitem_id
        WHERE h.node_id IN (SELECT node_id FROM raw.nodes WHERE node_id::text IN (${ids(machine)}))
        AND h.dataitem_id IN (SELECT node_id FROM raw.nodes WHERE node_id::text IN (${ids(signal)}))
        AND h.time >= ${literal(start.toISOString())}::timestamptz AND h.time < ${literal(end.toISOString())}::timestamptz
        ORDER BY h.time, h.node_id, h.dataitem_id, h.value::text LIMIT ${limit + 1}`);
      const count = frame.data.values[0]?.length ?? 0;
      if (!count) {
        setStatus('A kiválasztott időszakban nincs exportálható adat.');
        return;
      }
      const partial = count > limit;
      const delimiter = format === 'excel' ? ';' : ',';
      const lines = [[...frame.schema.fields.map((field) => field.name), 'Export teljessége']
        .map((value) => csvCell(value, delimiter)).join(delimiter)];
      for (let index = 0; index < Math.min(count, limit); index++) {
        lines.push([...frame.data.values.map((column) => column[index]), partial ? 'Részleges' : 'Teljes']
          .map((value) => csvCell(value, delimiter)).join(delimiter));
      }
      const url = URL.createObjectURL(new Blob([format === 'excel' ? '\uFEFF' : '', lines.join('\r\n'), '\r\n'],
        { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `kfgyr-export-${start.toISOString().slice(0, 10)}${partial ? '-reszleges' : ''}.csv`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus(partial ? `Részleges export. A fájl az első ${limit} sort tartalmazza.` : `Letöltés indítva. ${count} sor.`);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const signalDisabled = busy || loadingSignals || !signals.length;
  const ready = machine.length > 0 && signal.length > 0 && !signalDisabled;
  return (
    <PluginPage pageNav={{ text: 'Adatexport' }}>
      <div className={styles.page}>
        <form onSubmit={download} className={styles.form}>
          {error && <Alert title="Az adatexport művelete sikertelen" severity="error">{error}</Alert>}
          <section className={styles.formCard} aria-labelledby="export-source-heading">
            <div className={styles.formFooter}>
              <h3 id="export-source-heading">Gépek és adatpontok</h3>
              <Badge text={`${machine.length} gép · ${signal.length} adatpont`} color="blue" />
            </div>
            <p className={styles.note}>Több gépet és adatpontot is kiválaszthatsz. A listákban név szerint kereshetsz.</p>
            <Field label="Gépek" htmlFor="export-machines">
              <MultiCombobox
                id="export-machines"
                value={machine}
                options={machines.map(({ id, label }) => ({ value: id, label }))}
                placeholder="Keress vagy válassz gépeket…"
                noOptionsMessage="Nincs választható gép"
                loading={loadingMachines}
                disabled={busy || loadingMachines}
                onChange={(items) => {
                  const next = items.map(({ value }) => value);
                  setMachine(next);
                  setSignals([]);
                  setLoadingSignals(next.length > 0);
                  if (!next.length) {
                    setSignal([]);
                  }
                  setError('');
                  setStatus('');
                }}
              />
            </Field>
            <Field label="Adatpontok" htmlFor="export-signals">
              <MultiCombobox
                id="export-signals"
                value={loadingSignals ? [] : signal}
                options={signals.map(({ id, label }) => ({ value: id, label }))}
                placeholder={!machine.length ? 'Válassz először gépet' : loadingSignals ? 'Adatpontok betöltése…' : 'Keress adatpontot…'}
                noOptionsMessage="Nincs találat"
                loading={loadingSignals}
                disabled={signalDisabled}
                onChange={(items) => {
                  setSignal(items.map(({ value }) => value));
                  setStatus('');
                }}
              />
            </Field>
            {machine.length > 0 && !loadingSignals && !signals.length && !error && (
              <Alert title="A kiválasztott gépekhez még nincs adatpont." severity="info" />
            )}
            <div className={styles.actions}>
              <Button type="button" variant="secondary" disabled={signalDisabled || signal.length === signals.length}
                onClick={() => { setSignal(signals.map(({ id }) => id)); setStatus(''); }}>
                Összes adatpont kijelölése
              </Button>
              <Button type="button" variant="secondary" disabled={signalDisabled || !signal.length}
                onClick={() => { setSignal([]); setStatus(''); }}>
                Kijelölés törlése
              </Button>
            </div>
          </section>
          <section className={styles.formCard} aria-labelledby="export-options-heading">
            <h3 id="export-options-heading">Időszak és fájlformátum</h3>
            <p className={styles.note}>Az időszakot helyi időben add meg. A CSV UTC-időbélyegeket tartalmaz.</p>
            <div className={styles.grid}>
              <Field label="Kezdőidő" htmlFor="export-from">
                <Input id="export-from" type="datetime-local" value={from} disabled={busy} required
                  onChange={(event) => { setFrom(event.currentTarget.value); setStatus(''); }} />
              </Field>
              <Field label="Végidő" htmlFor="export-to">
                <Input id="export-to" type="datetime-local" value={to} disabled={busy} required
                  onChange={(event) => { setTo(event.currentTarget.value); setStatus(''); }} />
              </Field>
              <Field label="Sorkorlát" htmlFor="export-limit">
                <Combobox id="export-limit" value={limit} disabled={busy}
                  options={[1000, 10000, 50000, 100000].map((value) => ({ value, label: value.toLocaleString('hu-HU') }))}
                  onChange={({ value }) => { setLimit(value); setStatus(''); }} />
              </Field>
              <Field label="Formátum" htmlFor="export-format">
                <Combobox id="export-format" value={format} disabled={busy}
                  options={[{ value: 'csv', label: 'CSV (vesszővel)' }, { value: 'excel', label: 'Excelhez formázott CSV (pontosvesszővel)' }]}
                  onChange={({ value }) => { setFormat(value); setStatus(''); }} />
              </Field>
            </div>
            {status && <Alert title={status} severity={status.startsWith('Részleges') ? 'warning' : 'info'} />}
            <div className={styles.footer}>
              <Button type="submit" icon={busy ? 'spinner' : 'download-alt'} disabled={!ready}>
                {busy ? 'Export készül…' : 'CSV letöltése'}
              </Button>
            </div>
          </section>
          <a href={config.appSubUrl + '/d/kfgyr-home'}>Vissza a kezdőlapra</a>
        </form>
      </div>
    </PluginPage>
  );
}
