import React, { useEffect, useRef, useState } from 'react';
import { Alert, Badge, Button, Field, Input, Modal, useStyles2 } from '@grafana/ui';
import { api } from '../api';
import { Agent, errorText, FoundDevice } from '../types';
import { getStyles } from './styles';

type Network = { cidr: string; interface: string; source: string };
type Result = { url: string; ip: string; port: number; devices: FoundDevice[] };
type Job = {
  id: string;
  state: string;
  completed: number;
  total: number;
  results: Result[];
  message?: string;
  network: string;
};
type Props = { agents: Agent[]; onClose: () => void; onAdd: (agent: Agent) => void };
const active = (job?: Job) => !!job && ['running', 'cancelling'].includes(job.state);
const canonical = (value: string) => {
  try {
    return new URL(value).href.replace(/\/$/, '');
  } catch {
    return value;
  }
};

export function NetworkDiscovery({ agents, onClose, onAdd }: Props) {
  const s = useStyles2(getStyles);
  const [networks, setNetworks] = useState<Network[]>([]);
  const [network, setNetwork] = useState('');
  const [ports, setPorts] = useState('80, 443, 5000, 5001, 8080');
  const [job, setJob] = useState<Job>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [closing, setClosing] = useState(false);
  const mounted = useRef(true);
  const jobId = job?.id;
  const jobState = job?.state;
  useEffect(() => {
    mounted.current = true;
    Promise.all([api<{ networks: Network[] }>('networks'), api<{ job?: Job }>('discovery')])
      .then(([found, latest]) => {
        if (!mounted.current) {
          return;
        }
        setNetworks(found.networks);
        setNetwork(found.networks[0]?.cidr || '');
        if (latest.job) {
          setJob(latest.job);
        }
      })
      .catch((e) => {
        if (mounted.current) {
          setError(errorText(e));
        }
      });
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!jobId || !['running', 'cancelling'].includes(jobState || '')) {
      return;
    }
    const timer = setInterval(() => {
      api<Job>(`discovery/${jobId}`)
        .then((next) => {
          if (mounted.current) {
            setJob(next);
            setError('');
          }
        })
        .catch((e) => {
          if (mounted.current) {
            setError(errorText(e));
          }
        });
    }, 1500);
    return () => clearInterval(timer);
  }, [jobId, jobState]);
  async function start(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    const values = ports.split(',').map((p) => Number(p.trim()));
    if (!values.length || values.length > 8 || values.some((p) => !Number.isInteger(p) || p < 1 || p > 65535)) {
      setError('1–8 portot adj meg, vesszővel elválasztva, 1 és 65535 között.');
      return;
    }
    setBusy(true);
    try {
      setJob(await api<Job>('discovery', 'POST', { network: network.trim(), ports: values }));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function cancel(close = false) {
    setBusy(true);
    try {
      if (active(job)) {
        setJob(await api<Job>(`discovery/${job!.id}`, 'DELETE'));
      }
      if (close) {
        onClose();
      }
      return true;
    } catch (e) {
      setError(errorText(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function add(result: Result) {
    if (active(job) && !(await cancel())) {
      return;
    }
    const base = `Agent ${result.ip}`;
    let alias = base;
    let suffix = 2;
    while (agents.some((a) => a.alias === alias)) {
      alias = `${base} ${suffix++}`;
    }
    onAdd({ alias, url: result.url, retention: '1week', devices: [] });
  }
  return (
    <Modal
      title="Agentek keresése a relay hálózatán"
      isOpen
      className={s.modal}
      contentClassName={s.modalContent}
      closeOnBackdropClick={false}
      onDismiss={() => (active(job) ? setClosing(true) : onClose())}
    >
      <div className={s.modalBody}>
        <p>A keresés a relay-runner felől történik. Az MTConnect választ adó címek jelennek meg találatként.</p>
        {closing && (
          <Alert title="Futó keresés bezárása" severity="warning">
            <p>Bezárás előtt leállítjuk a keresést. A találatok az újranyitáskor még elérhetők.</p>
            <div className={s.actions}>
              <Button variant="secondary" onClick={() => setClosing(false)}>
                Keresés folytatása
              </Button>
              <Button variant="destructive" disabled={busy} onClick={() => cancel(true)}>
                Leállítás és bezárás
              </Button>
            </div>
          </Alert>
        )}
        {error && (
          <Alert title="A keresés nem sikerült" severity="error">
            {error}
          </Alert>
        )}
        <form onSubmit={start}>
          <Field
            label="Hálózati tartomány"
            htmlFor="scan-network"
            description="A runner automatikusan felismert LAN-tartománya. Egyszerre legfeljebb 256 cím vizsgálható (/24 vagy kisebb hálózat)."
          >
            <Input
              id="scan-network"
              list="detected-networks"
              value={network}
              disabled={active(job)}
              placeholder="192.168.88.0/24"
              onChange={(e) => setNetwork(e.currentTarget.value)}
            />
          </Field>
          <datalist id="detected-networks">
            {networks.map((n) => (
              <option key={`${n.interface}-${n.cidr}`} value={n.cidr}>
                {n.interface}
              </option>
            ))}
          </datalist>
          <p className={s.note}>
            {networks.length
              ? `Elérhető hálózatok: ${networks.map((n) => `${n.cidr} (${n.interface})`).join(', ')}`
              : 'Nem található LAN-tartomány. Ellenőrizd a runner hosthálózati beállítását.'}
          </p>
          <Field
            label="Vizsgált portok"
            htmlFor="scan-ports"
            description="Vesszővel elválasztva. A 443-as porton HTTPS, a többin HTTP ellenőrzés történik."
          >
            <Input
              id="scan-ports"
              value={ports}
              disabled={active(job)}
              onChange={(e) => setPorts(e.currentTarget.value)}
            />
          </Field>
          <div className={s.actions}>
            <Button type="submit" icon="search" disabled={busy || active(job) || !network}>
              Keresés indítása
            </Button>
            {active(job) && (
              <Button
                type="button"
                variant="secondary"
                disabled={busy || job?.state === 'cancelling'}
                onClick={() => cancel()}
              >
                Keresés leállítása
              </Button>
            )}
          </div>
        </form>
        {job && (
          <div className={s.discovery} aria-live="polite">
            <div className={s.statusTitle}>
              <Badge
                color={job.state === 'completed' ? 'green' : job.state === 'failed' ? 'red' : 'blue'}
                text={
                  (
                    {
                      running: 'Keresés folyamatban',
                      cancelling: 'Leállítás…',
                      cancelled: 'Keresés leállítva',
                      completed: 'Keresés befejezve',
                      failed: 'Keresés megszakadt',
                    } as Record<string, string>
                  )[job.state] || job.state
                }
              />
              <span>
                {job.completed} / {job.total} cím–port ellenőrzés
              </span>
            </div>
            <progress
              aria-label="Hálózati keresés előrehaladása"
              max={Math.max(job.total, 1)}
              value={job.completed}
              style={{ width: '100%' }}
            />
            <p className={s.note}>
              {job.results.length} MTConnect agent · {job.network}
            </p>
            {job.message && <p>{job.message}</p>}
            {job.results.map((result) => {
              const exists = agents.some((a) => canonical(a.url) === canonical(result.url));
              return (
                <div key={result.url} className={s.discoveryRow}>
                  <div>
                    <strong>{result.url}</strong>
                    <div className={s.muted}>{result.devices.map((d) => d.name || d.id).join(', ')}</div>
                  </div>
                  <Button variant="secondary" size="sm" disabled={busy || exists} onClick={() => add(result)}>
                    {exists ? 'Már konfigurálva' : 'Agent beállítása'}
                  </Button>
                </div>
              );
            })}
            {job.state === 'completed' && !job.results.length && (
              <p>
                Nem találtunk agentet a megadott címeken és portokon. Más port vagy URL-útvonal esetén kézzel is
                hozzáadhatod.
              </p>
            )}
          </div>
        )}
      </div>
      <div className={s.footer}>
        <Button variant="secondary" onClick={() => (active(job) ? setClosing(true) : onClose())}>
          Bezárás
        </Button>
      </div>
    </Modal>
  );
}
