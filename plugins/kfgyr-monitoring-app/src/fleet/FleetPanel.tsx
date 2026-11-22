import React from 'react';
import { css } from '@emotion/css';
import type { GrafanaTheme2, PanelProps } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Badge, LinkButton, useStyles2 } from '@grafana/ui';
import { menu } from '../navigation/menu';

type State = { name: string; value: string | null };
type Gauge = { name: string; value: number | null; min: number | null; max: number | null; unit: string | null };

const numberFormat = new Intl.NumberFormat('hu-HU', { maximumSignificantDigits: 5 });

const getStyles = (theme: GrafanaTheme2) => ({
  card: css({
    height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 10,
    overflow: 'hidden', padding: '8px 10px', color: theme.colors.text.primary,
  }),
  header: css({ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }),
  identity: css({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', justifyItems: 'start', gap: 4, minWidth: 0 }),
  name: css({ margin: 0, maxWidth: '100%', fontSize: 17, lineHeight: 1.2 }),
  open: css({ flexShrink: 0 }),
  states: css({
    display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gridAutoRows: '20px',
    gap: '2px 10px', minHeight: 64,
  }),
  state: css({ fontSize: 13, fontWeight: 600, lineHeight: '20px' }),
  positive: css({ color: theme.colors.success.text }),
  caution: css({ color: theme.colors.warning.text }),
  fault: css({ color: theme.colors.error.text }),
  gauges: css({
    display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6, marginTop: 'auto',
  }),
  gauge: css({
    display: 'grid', justifyItems: 'center', alignContent: 'start', gap: 2, minWidth: 0,
    fontSize: 12, textAlign: 'center', fontVariantNumeric: 'tabular-nums',
  }),
  arc: css({
    position: 'relative', width: '100%', maxWidth: 66, aspectRatio: '2 / 1', borderRadius: '66px 66px 0 0',
    background: `conic-gradient(from 270deg at 50% 100%, ${theme.colors.primary.main} 0deg var(--gauge-angle), ${theme.colors.border.medium} var(--gauge-angle) 180deg, transparent 180deg)`,
    '&::after': {
      content: '""', position: 'absolute', inset: '5px 5px 0', borderRadius: '66px 66px 0 0',
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
  const machine = first('machine_id');
  if (typeof machine !== 'string') {
    return <div className={styles.empty}>{data.state === 'Done' ? 'Nincs megjeleníthető gép.' : ''}</div>;
  }

  const agent = String(first('agent') || 'Ismeretlen agent');
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
      <header className={styles.header}>
        <div className={styles.identity}>
          <Badge color="blue" text={agent} className={styles.truncated} title={agent} />
          <h2 className={`${styles.name} ${styles.truncated}`} title={name}>{name}</h2>
        </div>
        <LinkButton href={`${config.appSubUrl}${menu.monitoring.path}?${params}`} className={styles.open}
          aria-label={openLabel} title={openLabel} size="sm" variant="secondary" fill="text" icon="external-link-alt" />
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
            return <span key={index} className={`${styles.state} ${styles.truncated} ${color}`} title={label} aria-label={label}>
              {value ?? '–'}
            </span>;
          })}
        </div>
      )}
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
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}
