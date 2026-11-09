import React, { useEffect, useState } from 'react';
import { config, getBackendSrv, PluginPage } from '@grafana/runtime';
import { Alert, Button, Field, Input } from '@grafana/ui';
import { lastValueFrom } from 'rxjs';
import { errorText } from '../types';

type Option = { id: string; label: string };
type Cell = string | number | boolean | null;
type Frame = { schema: { fields: Array<{ name: string }> }; data: { values: Cell[][] } };
const datasource = { uid: 'timescaledb', type: 'grafana-postgresql-datasource' };
const devices = "SELECT node_id::text, props->>'path' FROM raw.nodes WHERE props->>'node_type'='Device' ORDER BY 2";
const literal = (value: string) => "'" + value.replace(/'/g, "''") + "'";
const selected = (element: HTMLSelectElement) => Array.from(element.selectedOptions, (item) => item.value);
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
    options(devices).then(setMachines).catch((err) => setError(errorText(err)));
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
      .then((items) => active && setSignals(items))
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

  return (
    <PluginPage pageNav={{ text: 'Adatexport' }}>
      <p>Válaszd ki a gépeket, az adatpontokat és a helyi idő szerint megadott időszakot. A fájl UTC-időbélyegeket tartalmaz.</p>
      {error && <Alert title={error} severity="error" />}
      {status && <Alert title={status} severity={status.startsWith('Részleges') ? 'warning' : 'info'} />}
      <form onSubmit={download} style={{ maxWidth: 860 }}>
        <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
          <Field label="Gépek" htmlFor="export-machines">
            <select id="export-machines" multiple value={machine} onChange={(event) => {
              setMachine(selected(event.target));
              setSignal([]);
              setSignals([]);
              setLoadingSignals(false);
            }}>
              {machines.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </Field>
          <Field label={loadingSignals ? 'Adatpontok betöltése…' : 'Adatpontok'} htmlFor="export-signals">
            <select id="export-signals" multiple value={signal} onChange={(event) => setSignal(selected(event.target))}>
              {signals.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </Field>
          <Button type="button" variant="secondary" disabled={!signals.length} onClick={() => setSignal(signals.map((item) => item.id))}>
            Összes adatpont kiválasztása
          </Button>
          <Field label="Kezdőidő" htmlFor="export-from">
            <Input id="export-from" type="datetime-local" value={from} onChange={(event) => setFrom(event.currentTarget.value)} required />
          </Field>
          <Field label="Végidő" htmlFor="export-to">
            <Input id="export-to" type="datetime-local" value={to} onChange={(event) => setTo(event.currentTarget.value)} required />
          </Field>
          <Field label="Sorkorlát" htmlFor="export-limit">
            <select id="export-limit" value={limit} onChange={(event) => setLimit(Number(event.target.value))}>
              {[1000, 10000, 50000, 100000].map((value) => <option key={value}>{value}</option>)}
            </select>
          </Field>
          <Field label="Formátum" htmlFor="export-format">
            <select id="export-format" value={format} onChange={(event) => setFormat(event.target.value)}>
              <option value="csv">CSV (vesszővel)</option>
              <option value="excel">Excelhez formázott CSV (pontosvesszővel)</option>
            </select>
          </Field>
          <Button type="submit" disabled={!machine.length || !signal.length || busy}>
            {busy ? 'Export készül…' : 'CSV letöltése'}
          </Button>
          <p><a href={config.appSubUrl + '/d/kfgyr-home'}>Vissza a kezdőlapra</a></p>
        </fieldset>
      </form>
    </PluginPage>
  );
}
