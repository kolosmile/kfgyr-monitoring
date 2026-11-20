import React, { useEffect, useState } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2, PanelProps } from '@grafana/data';
import { config, getBackendSrv, locationService } from '@grafana/runtime';
import { Badge, Combobox, LinkButton, useStyles2 } from '@grafana/ui';
import { lastValueFrom } from 'rxjs';
import { HomeLink } from '../components/HomeLink';
import { menu } from './menu';

type Row = {
  machine: string;
  agent: string;
  name: string;
  dashboard: string;
  dashboardName: string;
};

const getStyles = (theme: GrafanaTheme2) => ({
  bar: css({
    height: '100%',
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1.5),
    flexWrap: 'nowrap',
    overflow: 'hidden',
    padding: theme.spacing(0, 12, 0, 3),
  }),
  controls: css({
    display: 'flex',
    flex: '1 1 auto',
    alignItems: 'flex-end',
    gap: theme.spacing(1),
    flexWrap: 'nowrap',
    minWidth: 0,
    transform: 'translateY(-2px)',
  }),
  select: css({ width: 180, maxWidth: '100%', minWidth: 0 }),
  homeActions: css({ display: 'flex', alignItems: 'center', gap: theme.spacing(1), flexShrink: 0 }),
  machineTitle: css({ minWidth: 0, maxWidth: 360, marginLeft: 'auto', overflow: 'hidden', textOverflow: 'ellipsis',
    whiteSpace: 'nowrap', textAlign: 'right', fontSize: 24, lineHeight: 1.05, fontWeight: 700, color: theme.colors.text.primary }),
  label: css({ display: 'block', color: theme.colors.text.secondary, fontSize: 11, marginBottom: 2 }),
  badge: css({ alignSelf: 'flex-end', paddingBottom: 6 }),
});

export function MonitoringMenu({ data, replaceVariables }: PanelProps) {
  const styles = useStyles2(getStyles);
  const [availability, setAvailability] = useState<'checking' | 'online' | 'offline' | 'unknown'>('checking');
  const machine = replaceVariables('${machine}');
  const dashboard = replaceVariables('${dashboard}');
  const dashboardEditorUrl = machine && /^\d+$/.test(dashboard)
    ? `${config.appSubUrl}${menu.dashboard.path}?machine=${encodeURIComponent(machine)}&dashboard=${encodeURIComponent(dashboard)}`
    : undefined;
  const frame = data.series[0];
  const field = (name: string, index: number) => frame?.fields.find((item) => item.name === name)?.values[index];
  const rows: Row[] = Array.from({ length: frame?.length || 0 }, (_, index) => ({
    machine: String(field('machine_id', index) ?? ''),
    agent: String(field('agent', index) ?? ''),
    name: String(field('machine_name', index) ?? ''),
    dashboard: String(field('dashboard_id', index) ?? ''),
    dashboardName: String(field('dashboard_name', index) ?? ''),
  }));
  const selected = rows.find((row) => row.machine === machine);
  const agents = [...new Set(rows.map((row) => row.agent).filter(Boolean))];
  const machines = rows.filter((row, index) => row.agent === selected?.agent &&
    rows.findIndex((item) => item.machine === row.machine) === index);
  const dashboards = rows.filter((row) => row.machine === machine && row.dashboard);

  useEffect(() => {
    if (!/^\d+$/.test(machine)) {
      setAvailability('unknown');
      return;
    }
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    setAvailability('checking');
    async function check() {
      try {
        const response = await lastValueFrom(getBackendSrv().fetch<{ status: 'online' | 'offline' | 'unknown' }>({
          url: `/api/plugins/kfgyr-monitoring-app/resources/availability/${encodeURIComponent(machine)}`,
          showErrorAlert: false,
        }));
        if (active) {
          setAvailability(response.data.status);
        }
      } catch {
        if (active) {
          setAvailability('unknown');
        }
      } finally {
        if (active) {
          timer = setTimeout(check, 30000);
        }
      }
    }
    void check();
    return () => { active = false; clearTimeout(timer); };
  }, [machine]);

  function selectMachine(row: Row) {
    locationService.partial({ 'var-machine': row.machine, 'var-dashboard': row.dashboard || null }, true);
  }

  return (
    <nav className={styles.bar} aria-label="Monitoring navigáció">
      <div className={styles.controls}>
        <div className={styles.homeActions}>
          <HomeLink />
          {dashboardEditorUrl && (
            <LinkButton href={dashboardEditorUrl} icon="pen" variant="secondary">
              Dashboard szerkesztése
            </LinkButton>
          )}
        </div>
        <div className={styles.select}>
          <label className={styles.label} htmlFor="monitoring-menu-agent">Agent</label>
          <Combobox id="monitoring-menu-agent" aria-label="Agent" value={selected?.agent || null}
            options={agents.map((agent) => ({ value: agent, label: agent }))}
            placeholder="Agent" onChange={({ value }) => {
              const first = rows.find((row) => row.agent === value);
              if (first) { selectMachine(first); }
            }} />
        </div>
        <div className={styles.select}>
          <label className={styles.label} htmlFor="monitoring-menu-machine">Gép</label>
          <Combobox id="monitoring-menu-machine" aria-label="Gép" value={selected?.machine || null}
            options={machines.map((row) => ({ value: row.machine, label: row.name }))}
            placeholder="Gép" onChange={({ value }) => {
              const next = machines.find((row) => row.machine === value);
              if (next) { selectMachine(next); }
            }} />
        </div>
        <div className={styles.select}>
          <label className={styles.label} htmlFor="monitoring-menu-dashboard">Dashboard</label>
          <Combobox id="monitoring-menu-dashboard" aria-label="Dashboard" value={dashboards.some((row) => row.dashboard === dashboard) ? dashboard : null}
            options={dashboards.map((row) => ({ value: row.dashboard, label: row.dashboardName }))}
            placeholder="Dashboard" onChange={({ value }) => locationService.partial({ 'var-dashboard': value }, true)} />
        </div>
        <span className={styles.badge}>
          <Badge color={availability === 'online' ? 'green' : availability === 'offline' ? 'red' : 'darkgrey'}
            text={availability === 'online' ? 'Agent elérhető' : availability === 'offline' ? 'Agent nem elérhető' :
              availability === 'checking' ? 'Agent ellenőrzése…' : 'Agent elérhetősége ismeretlen'} />
        </span>
      </div>
      {selected?.name && <div className={styles.machineTitle} title={selected.name}>{selected.name}</div>}
    </nav>
  );
}
