import React, { useEffect, useState } from 'react';
import { css } from '@emotion/css';
import type { GrafanaTheme2, PanelProps } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Badge, LinkButton, useStyles2 } from '@grafana/ui';
import { api } from '../api';
import { menu } from '../navigation/menu';

type State = { name: string; value: string | null };
type Gauge = { name: string; value: number | null; min: number | null; max: number | null; unit: string | null };
type AgentStatus = 'online' | 'offline' | 'unknown';

const availabilityInterval = 30000;
const availabilityChecks = new Map<string, { started: number; status: Promise<AgentStatus> }>();

function checkAgent(agent: string, machine: string): Promise<AgentStatus> {
  const current = availabilityChecks.get(agent);
  const now = Date.now();
  if (current && now - current.started < availabilityInterval) {
    return current.status;
  }
  const status = api<{ status: AgentStatus; agent_status?: AgentStatus }>(`availability/${encodeURIComponent(machine)}`)
    .then((result) => result.agent_status ?? result.status)
    .catch((): AgentStatus => 'unknown');
  availabilityChecks.set(agent, { started: now, status });
  return status;
}

const agentBadges = {
  online: { color: 'green', label: 'Elérhető' },
  offline: { color: 'red', label: 'Nem elérhető' },
  unknown: { color: 'darkgrey', label: 'Az elérhetőség ismeretlen' },
} as const;

const numberFormat = new Intl.NumberFormat('hu-HU', { maximumSignificantDigits: 5 });

const getStyles = (theme: GrafanaTheme2) => ({
  card: css({
    height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 8,
    overflow: 'hidden', padding: '8px 10px', color: theme.colors.text.primary,
  }),
  identity: css({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', justifyItems: 'start', gap: 4, minWidth: 0 }),
  name: css({ margin: 0, maxWidth: '100%', fontSize: 17, lineHeight: 1.2 }),
  footer: css({ display: 'flex', alignItems: 'flex-end', gap: 6, marginTop: 'auto' }),
  open: css({ flexShrink: 0, marginLeft: 'auto' }),
  states: css({
    display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gridAutoRows: '29px',
    gap: '3px 10px', minHeight: 93,
  }),
  stateCell: css({ display: 'grid', alignContent: 'end', minWidth: 0 }),
  state: css({ fontSize: 13, fontWeight: 600, lineHeight: '17px' }),
  caption: css({ fontSize: 10, fontWeight: 400, lineHeight: '12px', color: theme.colors.text.secondary }),
  positive: css({ color: theme.colors.success.text }),
  caution: css({ color: theme.colors.warning.text }),
  fault: css({ color: theme.colors.error.text }),
  gauges: css({
    flex: '1 1 auto', minWidth: 0,
    display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6,
  }),
  gauge: css({
    display: 'grid', justifyItems: 'center', alignContent: 'start', gap: 2, minWidth: 0,
    fontSize: 12, lineHeight: '14px', textAlign: 'center', fontVariantNumeric: 'tabular-nums',
  }),
  arc: css({
    position: 'relative', width: '100%', maxWidth: 60, aspectRatio: '2 / 1', borderRadius: '60px 60px 0 0',
    background: `conic-gradient(from 270deg at 50% 100%, ${theme.colors.primary.main} 0deg var(--gauge-angle), ${theme.colors.border.medium} var(--gauge-angle) 180deg, transparent 180deg)`,
    '&::after': {
      content: '""', position: 'absolute', inset: '5px 5px 0', borderRadius: '60px 60px 0 0',
      background: theme.colors.background.primary,
    },
  }),
  truncated: css({ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }),
  empty: css({ color: theme.colors.text.secondary, fontSize: 12 }),
});

function items<T>(value: unknown): T[] {
  if (typeof value !== 'string') {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function FleetPanel({ data }: PanelProps) {
  const styles = useStyles2(getStyles);
  const frame = data.series[0];
  const first = (field: string) => frame?.fields.find(({ name }) => name === field)?.values[0];
  const machineId = first('machine_id');
  const machine = typeof machineId === 'string' ? machineId : '';
  const agentName = first('agent');
  const agent = typeof agentName === 'string' ? agentName : '';
  const [availability, setAvailability] = useState<{ agent: string; status: AgentStatus }>();

  useEffect(() => {
    if (!agent || !/^\d{1,19}$/.test(machine)) {
      return;
    }
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function update() {
      const status = await checkAgent(agent, machine);
      if (active) {
        setAvailability({ agent, status });
        timer = setTimeout(update, availabilityInterval);
      }
    }
    void update();
    return () => { active = false; clearTimeout(timer); };
  }, [agent, machine]);

  if (!machine) {
    return <div className={styles.empty}>{data.state === 'Done' ? 'Nincs megjeleníthető gép.' : ''}</div>;
  }

  const agentLabel = agent || 'Ismeretlen agent';
  const badge = agentBadges[availability?.agent === agent ? availability.status : 'unknown'];
  const name = String(first('machine_name') || machine);
  const dashboard = first('dashboard_id');
  const states = items<State>(first('states')).slice(0, 6);
  const gauges = items<Gauge>(first('gauges')).slice(0, 3);
  const params = new URLSearchParams({ 'var-machine': machine });
  if (typeof dashboard === 'string' && dashboard) {
    params.set('var-dashboard', dashboard);
  }
  const openLabel = `${name} megnyitása a Monitoringban`;

  return (
    <article className={styles.card} aria-label={name}>
      <header className={styles.identity}>
        <Badge color={badge.color} text={agentLabel} className={styles.truncated}
          title={`${agentLabel} · ${badge.label}`} aria-label={`${agentLabel} · ${badge.label}`} />
        <h2 className={`${styles.name} ${styles.truncated}`} title={name}>{name}</h2>
      </header>
      {!states.length && !gauges.length && (
        <div className={styles.empty}>{dashboard ? 'Nincs beállított állapot vagy műszer.' : 'Nincs alapértelmezett dashboard.'}</div>
      )}
      {states.length > 0 && (
        <div className={styles.states} aria-label="Állapotok">
          {states.map(({ name, value }, index) => {
            const state = value?.toUpperCase();
            const color = state === 'AVAILABLE' || state === 'ACTIVE' || state === 'NORMAL' ? styles.positive
              : state === 'UNAVAILABLE' || state === 'FAULT' || state === 'ALARM' ? styles.fault
              : state === 'WARNING' ? styles.caution : '';
            const label = `${name}: ${value ?? 'Nincs érték'}`;
            return (
              <div key={index} className={styles.stateCell} title={label}>
                <span className={`${styles.state} ${styles.truncated} ${color}`}>{value ?? '–'}</span>
                <span className={`${styles.caption} ${styles.truncated}`}>{name}</span>
              </div>
            );
          })}
        </div>
      )}
      <footer className={styles.footer}>
        {gauges.length > 0 && (
          <div className={styles.gauges} aria-label="Műszerek">
            {gauges.map(({ name, value, min, max, unit }, index) => {
              const ratio = value !== null && min !== null && max !== null && max > min
                ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0;
              const text = value === null ? '–' : `${numberFormat.format(value)}${unit ? ` ${unit}` : ''}`;
              const label = `${name}: ${value === null ? 'Nincs érték' : text}`;
              return (
                <div key={index} className={styles.gauge} title={label} aria-label={label}>
                  <div className={styles.arc} style={{ '--gauge-angle': `${180 * ratio}deg` } as React.CSSProperties} aria-hidden />
                  <span className={styles.truncated}>{text}</span>
                  <span className={`${styles.caption} ${styles.truncated}`}>{name}</span>
                </div>
              );
            })}
          </div>
        )}
        <LinkButton href={`${config.appSubUrl}${menu.monitoring.path}?${params}`} className={styles.open}
          aria-label={openLabel} title={openLabel} size="sm" variant="secondary" fill="text" icon="external-link-alt" />
      </footer>
    </article>
  );
}
