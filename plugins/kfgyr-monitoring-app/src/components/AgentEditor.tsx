import React, { useEffect, useRef, useState } from 'react';
import { Alert, Badge, Button, Combobox, Field, Input, Modal, Switch, useStyles2 } from '@grafana/ui';
import { Agent, aliasPattern, clone, errorText, FoundDevice, retentionPattern, SchemaOption } from '../types';
import { getStyles } from './styles';

type Props = {
  initial: Agent;
  found?: FoundDevice[];
  existing?: Agent;
  otherAliases: string[];
  isNew: boolean;
  onClose: () => void;
  onApply: (agent: Agent) => void;
  onDirty: (dirty: boolean) => void;
  probe: (url: string) => Promise<{ devices: FoundDevice[] }>;
  schemaOptions: SchemaOption[];
  schemaLoadError?: string;
};

function mergeDevices(saved: Agent['devices'], found: FoundDevice[]): Agent['devices'] {
  const byId = new Map(saved.map((device) => [device.id, device]));
  const discovered = found.map((device) => byId.get(device.id) || {
    id: device.id,
    alias: device.uuid || device.name || device.id,
  });
  const foundIds = new Set(found.map((device) => device.id));
  return [...discovered, ...saved.filter((device) => !foundIds.has(device.id))];
}

export function AgentEditor({ initial, found, existing, otherAliases, isNew, onClose, onApply, onDirty, probe,
  schemaOptions, schemaLoadError }: Props) {
  const s = useStyles2(getStyles);
  const [draft, setDraft] = useState<Agent>(() => ({
    ...clone(initial),
    devices: mergeDevices(initial.devices || [], found || []),
  }));
  const [submitted, setSubmitted] = useState(false);
  const [urlTouched, setUrlTouched] = useState(false);
  const [closing, setClosing] = useState(false);
  const [probing, setProbing] = useState(false);
  const [probeResult, setProbeResult] = useState<{ url: string; devices: FoundDevice[] } | undefined>(
    () => found ? { url: initial.url.trim(), devices: found } : undefined
  );
  const [probeError, setProbeError] = useState('');
  const request = useRef(0);
  const draftRef = useRef(draft);
  const probeRef = useRef(probe);
  const dirtyCallback = useRef(onDirty);
  useEffect(() => {
    probeRef.current = probe;
    dirtyCallback.current = onDirty;
  }, [probe, onDirty]);
  useEffect(() => {
    const url = draft.url.trim();
    if (!url) {
      return;
    }
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
        return;
      }
    } catch {
      return;
    }
    const currentRequest = ++request.current;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setProbing(true);
      setProbeError('');
      try {
        const result = await probeRef.current(url);
        if (!cancelled && request.current === currentRequest) {
          setProbeResult({ url, devices: result.devices });
          const current = draftRef.current;
          const next = { ...current, devices: mergeDevices(current.devices || [], result.devices) };
          draftRef.current = next;
          setDraft(next);
          dirtyCallback.current(JSON.stringify(next) !== JSON.stringify(initial));
        }
      } catch (error) {
        if (!cancelled && request.current === currentRequest) {
          setProbeError(errorText(error));
        }
      } finally {
        if (!cancelled && request.current === currentRequest) {
          setProbing(false);
        }
      }
    }, 600);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [draft.url, found, initial]);
  useEffect(
    () => () => {
      request.current++;
    },
    []
  );
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  function change(next: Agent) {
    draftRef.current = next;
    setDraft(next);
    onDirty(JSON.stringify(next) !== JSON.stringify(initial));
  }
  function dismiss() {
    if (dirty) {
      setClosing(true);
    } else {
      onClose();
    }
  }
  const errors: Record<string, string> = {};
  if (!aliasPattern.test(draft.alias.trim())) {
    errors.alias =
      '1–64 karakter; betűvel vagy számmal kezdődjön. Betű, szám, szóköz, pont, kötőjel és aláhúzás használható.';
  } else if (otherAliases.includes(draft.alias.trim())) {
    errors.alias = 'Ez az agentnév már szerepel a listában. Adj meg egy másik nevet.';
  }
  try {
    const url = new URL(draft.url.trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
      throw new Error();
    }
  } catch {
    errors.url = 'Teljes HTTP vagy HTTPS cím szükséges, például http://192.168.1.20:5000.';
  }
  if (draft.retention && !retentionPattern.test(draft.retention.trim())) {
    errors.retention = 'Például 1week, 30days vagy 12months. Az érték legyen 1–9999 közötti egész szám.';
  }
  const devices = draft.devices || [];
  devices.forEach((device, i) => {
    if (!/^[a-zA-Z0-9_.:-]{1,128}$/.test(device.id)) {
      errors[`id-${i}`] = 'Érvényes MTConnect eszközazonosító szükséges.';
    } else if (devices.some((other, j) => i !== j && other.id === device.id)) {
      errors[`id-${i}`] = 'Ez az eszközazonosító már szerepel.';
    }
    if (!aliasPattern.test(device.alias)) {
      errors[`device-${i}`] = 'Adj meg érvényes, 1–64 karakteres nevet.';
    } else if (devices.some((other, j) => i !== j && other.alias === device.alias)) {
      errors[`device-${i}`] = 'Ez az eszköznév már szerepel ennél az agentnél.';
    }
    if (!device.schema_id || !schemaOptions.some((schema) => schema.id === device.schema_id)) {
      errors[`schema-${i}`] = schemaOptions.length ? 'Válassz sémát ehhez a géphez.' : 'Előbb hozz létre egy sémát a Sémakezelőben.';
    }
  });
  function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length) {
      return;
    }
    if ((!existing || draft.url.trim() !== existing.url.trim()) && probeResult?.url !== draft.url.trim()) {
      setProbeError('A mentéshez előbb sikeresen le kell kérdezni az agent eszközeit.');
      return;
    }
    onApply({ ...draft, alias: draft.alias.trim(), url: draft.url.trim(), retention: draft.retention?.trim() });
  }
  async function discover() {
    const url = draft.url.trim();
    if (errors.url) {
      setUrlTouched(true);
      return;
    }
    const currentRequest = ++request.current;
    setProbing(true);
    setProbeError('');
    setProbeResult(undefined);
    try {
      const result = await probe(url);
      if (request.current === currentRequest) {
        setProbeResult({ url, devices: result.devices });
        const current = draftRef.current;
        change({ ...current, devices: mergeDevices(current.devices || [], result.devices) });
      }
    } catch (error) {
      if (request.current === currentRequest) {
        setProbeError(errorText(error));
      }
    } finally {
      if (request.current === currentRequest) {
        setProbing(false);
      }
    }
  }
  const fieldError = (key: string) => (submitted || (key === 'url' && urlTouched) ? errors[key] : undefined);
  return (
    <Modal
      title={isNew ? 'Új MTConnect agent' : `${initial.alias} szerkesztése`}
      isOpen
      onDismiss={dismiss}
      closeOnBackdropClick={false}
      className={s.modal}
      contentClassName={s.modalContent}
    >
      <form onSubmit={submit} noValidate>
        <div className={s.modalBody}>
          {closing && (
            <Alert title="Elveted az űrlap módosításait?" severity="warning">
              <p>Az itt beírt változtatások még nem kerültek az agentlistába.</p>
              <div className={s.actions}>
                <Button type="button" variant="secondary" onClick={() => setClosing(false)}>
                  Szerkesztés folytatása
                </Button>
                <Button type="button" variant="destructive" onClick={onClose}>
                  Űrlap elvetése
                </Button>
              </div>
            </Alert>
          )}
          <section className={s.section} aria-label="Kapcsolat beállításai">
            <h3>Kapcsolat</h3>
            <Field
              label="Agent neve"
              htmlFor="agent-alias"
              invalid={!!fieldError('alias')}
              error={fieldError('alias')}
              description={
                existing
                  ? 'A mentett név az adatok azonosítására szolgál, ezért nem módosítható.'
                  : 'Egyedi név, amely alapján felismered ezt az MTConnect kapcsolatot.'
              }
            >
              <Input
                id="agent-alias"
                autoFocus
                value={draft.alias}
                disabled={!!existing}
                placeholder="Például: Műhely 1"
                onChange={(e) => change({ ...draft, alias: e.currentTarget.value })}
              />
            </Field>
            <Field
              label="MTConnect agent címe"
              htmlFor="agent-url"
              invalid={!!fieldError('url')}
              error={fieldError('url')}
              description="IP-cím és port is megadható. A címnek a szerverről elérhetőnek és az engedélyezett hálózatban kell lennie."
            >
              <Input
                id="agent-url"
                value={draft.url}
                placeholder="http://192.168.1.20:5000"
                onChange={(e) => {
                  request.current++;
                  setProbing(false);
                  setProbeResult(undefined);
                  setProbeError('');
                  change({ ...draft, url: e.currentTarget.value });
                }}
              />
            </Field>
            <div className={s.probeRow}>
              <Button
                type="button"
                variant="secondary"
                icon={probing ? 'sync' : 'search'}
                disabled={probing || !draft.url.trim()}
                onClick={discover}
              >
                {probing ? 'Kapcsolódás…' : 'Kapcsolat és eszközkeresés'}
              </Button>
              <Badge
                color={draft.ignore ? 'darkgrey' : 'blue'}
                text={draft.ignore ? 'Szüneteltetett agent' : 'Engedélyezett agent'}
              />
            </div>
            {probeError && (
              <Alert title="Az agent nem kérdezhető le" severity="error">
                {probeError}
              </Alert>
            )}
          </section>
          <section className={s.section} aria-label="Adatgyűjtés beállításai">
            <h3>Adatgyűjtés</h3>
            <div className={s.grid}>
              <Field
                label="Adatok megőrzési ideje"
                htmlFor="agent-retention"
                invalid={!!fieldError('retention')}
                error={fieldError('retention')}
                description="Például 1week vagy 30days. Üresen a közös beállítást örökli."
              >
                <Input
                  id="agent-retention"
                  value={draft.retention || ''}
                  placeholder="1week"
                  onChange={(e) => change({ ...draft, retention: e.currentTarget.value })}
                />
              </Field>
              <Field
                label="Agent engedélyezve"
                htmlFor="agent-enabled"
                description="Kikapcsolva a teljes agent adatgyűjtése szünetel. A tárolt adatok megmaradnak."
              >
                <Switch
                  id="agent-enabled"
                  value={!draft.ignore}
                  onChange={(e) => change({ ...draft, ignore: !e.currentTarget.checked })}
                />
              </Field>
            </div>
          </section>
          <section className={s.section} aria-label="Gépek">
            <h3>Gépek</h3>
            <p className={s.note}>Az agent gépeinek azonosítója kötött. Minden géphez kötelező sémát választani; automatikus alapértelmezés nincs.</p>
            {schemaLoadError && <Alert severity="error" title="A sémák nem tölthetők be">{schemaLoadError}</Alert>}
            {!schemaLoadError && schemaOptions.length === 0 && <Alert severity="info" title="Még nincs választható séma">
              A gépek felvételéhez előbb hozz létre egy sémát a Sémakezelőben.
            </Alert>}
            {probing && <p>Gépek lekérdezése…</p>}
            {!probing && !probeResult && !probeError && <p>Add meg az agent címét a gépek lekérdezéséhez.</p>}
            {!probing && !probeResult && probeError && <p>A gépek listája nem érhető el.</p>}
            {!probing && probeResult && probeResult.devices.length === 0 && <p>Az agent nem adott vissza gépet.</p>}
            {devices.map((device, i) => {
              const missing = !!probeResult && !probeResult.devices.some((item) => item.id === device.id);
              return (
                <div key={i} className={s.device}>
                  {missing && <Alert severity="warning" title="Korábban mentett, jelenleg nem felismert gép">
                    A bejegyzés megmarad, amíg el nem távolítod.
                  </Alert>}
                  <Field
                    label="MTConnect eszköz ID"
                    htmlFor={`device-id-${i}`}
                    invalid={!!fieldError(`id-${i}`)}
                    error={fieldError(`id-${i}`)}
                  >
                    <Input
                      id={`device-id-${i}`}
                      value={device.id}
                      readOnly
                    />
                  </Field>
                  <Field
                    label="Megjelenítési név"
                    htmlFor={`device-alias-${i}`}
                    invalid={!!fieldError(`device-${i}`)}
                    error={fieldError(`device-${i}`)}
                  >
                    <Input
                      id={`device-alias-${i}`}
                      value={device.alias}
                      placeholder="Például: Mazak"
                      onChange={(e) =>
                        change({
                          ...draft,
                          devices: devices.map((d, j) => (j === i ? { ...d, alias: e.currentTarget.value } : d)),
                        })
                      }
                    />
                  </Field>
                  <Field
                    label="Séma"
                    htmlFor={`device-schema-${i}`}
                    invalid={!!fieldError(`schema-${i}`)}
                    error={fieldError(`schema-${i}`)}
                    description="A gép adatpontjait ehhez a sémához rendeli."
                  >
                    <Combobox
                      id={`device-schema-${i}`}
                      value={schemaOptions.some((schema) => schema.id === device.schema_id) ? device.schema_id! : null}
                      placeholder="Válassz sémát"
                      options={schemaOptions.map((schema) => ({ value: schema.id, label: schema.name }))}
                      onChange={({ value }) =>
                        change({
                          ...draft,
                          devices: devices.map((d, j) => (j === i ? { ...d, schema_id: value || undefined } : d)),
                        })
                      }
                    />
                  </Field>
                  {missing && <div style={{ paddingTop: 24 }}>
                    <Button
                      type="button"
                      variant="secondary"
                      icon="trash-alt"
                      aria-label={`${device.alias || i + 1} eszköznév eltávolítása`}
                      onClick={() => change({ ...draft, devices: devices.filter((_, j) => i !== j) })}
                    >
                      Eltávolítás
                    </Button>
                  </div>}
                </div>
              );
            })}
          </section>
          {submitted && Object.keys(errors).length > 0 && (
            <p role="alert" className={s.error}>
              Javítsd a megjelölt mezőket a folytatáshoz.
            </p>
          )}
        </div>
        <p className={s.note}>
          Az agentlistába kerülő változtatásokat a főoldali „Mentés és alkalmazás” gombbal élesítheted.
        </p>
        <div className={s.footer}>
          <Button type="button" variant="secondary" onClick={dismiss}>
            Mégse
          </Button>
          <Button type="submit" icon="check" disabled={probing}>
            {isNew ? 'Hozzáadás a listához' : 'Módosítás a listában'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
