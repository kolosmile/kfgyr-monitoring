import React, { useEffect, useRef, useState } from 'react';
import { Alert, Badge, Button, Field, Icon, Input, Modal, Switch, useStyles2 } from '@grafana/ui';
import { Agent, aliasPattern, clone, errorText, FoundDevice, retentionPattern } from '../types';
import { getStyles } from './styles';

type Props = {
  initial: Agent;
  existing?: Agent;
  otherAliases: string[];
  isNew: boolean;
  onClose: () => void;
  onApply: (agent: Agent) => void;
  onDirty: (dirty: boolean) => void;
  probe: (url: string) => Promise<{ devices: FoundDevice[] }>;
};

export function AgentEditor({ initial, existing, otherAliases, isNew, onClose, onApply, onDirty, probe }: Props) {
  const s = useStyles2(getStyles);
  const [draft, setDraft] = useState<Agent>(() => clone(initial));
  const [submitted, setSubmitted] = useState(false);
  const [urlTouched, setUrlTouched] = useState(false);
  const [closing, setClosing] = useState(false);
  const [probing, setProbing] = useState(false);
  const [probeResult, setProbeResult] = useState<{ url: string; devices: FoundDevice[] }>();
  const [probeError, setProbeError] = useState('');
  const request = useRef(0);
  useEffect(
    () => () => {
      request.current++;
    },
    []
  );
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  function change(next: Agent) {
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
  });
  function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length) {
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
  function addDevice(device: FoundDevice) {
    const base =
      (device.name || device.id)
        .replace(/[^\p{L}\p{N}_. -]/gu, '_')
        .replace(/^[^\p{L}\p{N}]+/u, '')
        .slice(0, 58) || 'Eszköz';
    let alias = base;
    let suffix = 2;
    while (devices.some((d) => d.alias === alias)) {
      alias = `${base} ${suffix++}`;
    }
    change({ ...draft, devices: [...devices, { id: device.id, alias }] });
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
            {probeResult && (
              <div className={s.discovery} aria-live="polite">
                <div className={s.statusTitle}>
                  <Icon name="check-circle" /> Sikeres kapcsolat · {probeResult.devices.length} eszköz
                </div>
                <p className={s.note}>
                  A lekérdezés pillanatában az agent válaszolt. A lista gépeinek külön megjelenítési nevet adhatsz.
                </p>
                {probeResult.devices.length === 0 && (
                  <p>Az agent nem adott vissza eszközt. Ellenőrizd az MTConnect agent konfigurációját.</p>
                )}
                {probeResult.devices.map((device) => (
                  <div key={device.id} className={s.discoveryRow}>
                    <div>
                      <strong>{device.name || device.id}</strong>
                      <div className={s.agentUrl}>{device.id}</div>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      icon={devices.some((d) => d.id === device.id) ? 'check' : 'plus'}
                      disabled={devices.some((d) => d.id === device.id)}
                      onClick={() => addDevice(device)}
                    >
                      {devices.some((d) => d.id === device.id) ? 'Felvéve' : 'Név beállítása'}
                    </Button>
                  </div>
                ))}
              </div>
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
          <section className={s.section} aria-label="Eszköznevek beállításai">
            <div className={s.toolbar}>
              <h3>
                Eszköznevek <span className={s.muted}>({devices.length})</span>
              </h3>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                icon="plus"
                onClick={() => change({ ...draft, devices: [...devices, { id: '', alias: '' }] })}
              >
                Kézi hozzáadás
              </Button>
            </div>
            <p className={s.note}>
              A relay az agent összes eszközét gyűjti. Itt az elnevezéseket kezeled; egy név eltávolítása nem állítja le
              az eszköz adatgyűjtését.
              {existing?.devices?.length
                ? ' A már mentett azonosítók és nevek az adatok folytonossága miatt rögzítettek.'
                : ''}
            </p>
            {!devices.length && (
              <div className={s.discovery}>
                Még nincs egyedi eszköznév. Használd az eszközkeresést, vagy adj hozzá egyet kézzel.
              </div>
            )}
            {devices.map((device, i) => {
              const locked = existing?.devices?.some((d) => d.id === device.id);
              return (
                <div key={i} className={s.device}>
                  <Field
                    label="MTConnect eszköz ID"
                    htmlFor={`device-id-${i}`}
                    invalid={!!fieldError(`id-${i}`)}
                    error={fieldError(`id-${i}`)}
                  >
                    <Input
                      id={`device-id-${i}`}
                      value={device.id}
                      disabled={locked}
                      placeholder="Például: d1"
                      onChange={(e) =>
                        change({
                          ...draft,
                          devices: devices.map((d, j) => (j === i ? { ...d, id: e.currentTarget.value } : d)),
                        })
                      }
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
                      disabled={locked}
                      placeholder="Például: Mazak"
                      onChange={(e) =>
                        change({
                          ...draft,
                          devices: devices.map((d, j) => (j === i ? { ...d, alias: e.currentTarget.value } : d)),
                        })
                      }
                    />
                  </Field>
                  <div style={{ paddingTop: 24 }}>
                    <Button
                      type="button"
                      variant="secondary"
                      icon="trash-alt"
                      aria-label={`${device.alias || i + 1} eszköznév eltávolítása`}
                      onClick={() => change({ ...draft, devices: devices.filter((_, j) => i !== j) })}
                    >
                      Eltávolítás
                    </Button>
                  </div>
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
