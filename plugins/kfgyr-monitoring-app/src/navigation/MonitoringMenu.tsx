import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2, PanelProps } from '@grafana/data';
import { config, getBackendSrv, locationService } from '@grafana/runtime';
import { Badge, Button, Combobox, LinkButton, Modal, useStyles2 } from '@grafana/ui';
import { lastValueFrom } from 'rxjs';
import { HomeLink } from '../components/HomeLink';
import { useMobileLayout } from '../components/useMobileLayout';
import { menu } from './menu';
import { useAccess } from '../access';

type Row = {
  machine: string;
  agent: string;
  name: string;
  dashboard: string;
  dashboardName: string;
};

const subscribeToLocation = (onChange: () => void) => locationService.getHistory().listen(onChange);
const getLocationSearch = () => locationService.getLocation().search;

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
  machineTitle: css({ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: theme.spacing(1),
    minWidth: 0, maxWidth: 360, marginLeft: 'auto', overflow: 'hidden', textOverflow: 'ellipsis',
    whiteSpace: 'nowrap', textAlign: 'right', fontSize: 24, lineHeight: 1.05, fontWeight: 700, color: theme.colors.text.primary,
    '& > span': { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' } }),
  label: css({ display: 'block', color: theme.colors.text.secondary, fontSize: 11, marginBottom: 2 }),
  badge: css({ alignSelf: 'flex-end', paddingBottom: 6 }),
  mobileBar: css({
    height: '100%', display: 'flex', alignItems: 'center', gap: theme.spacing(0.75),
    '& > a': { flexShrink: 0 },
  }),
  mobileChooser: css({
    flex: '1 1 0', minWidth: 0, overflow: 'hidden',
    '& > svg': { flexShrink: 0 },
  }),
  mobileMachine: css({ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }),
  mobileSelectors: css({
    display: 'grid', gap: theme.spacing(1.5),
    '& > div': { width: '100%' },
    '& label': { fontSize: 13 },
    '& > span': { paddingBottom: 0 },
  }),
});

export function MonitoringMenu({ data, replaceVariables }: PanelProps) {
  const styles = useStyles2(getStyles);
  const { access } = useAccess();
  const mobile = useMobileLayout();
  const [choosing, setChoosing] = useState(false);
  const [availability, setAvailability] = useState<'checking' | 'online' | 'offline' | 'unknown'>('checking');
  const params = new URLSearchParams(useSyncExternalStore(subscribeToLocation, getLocationSearch));
  // Grafana can update its template variables after the URL changes.
  const machine = params.get('var-machine') ?? replaceVariables('${machine}');
  const dashboard = params.get('var-dashboard') ?? replaceVariables('${dashboard}');
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
  const currentDashboard = dashboards.find((row) => row.dashboard === dashboard);
  const canCreateDashboard = !!selected && dashboards.length === 0;
  const dashboardEditorUrl = `${config.appSubUrl}${menu.dashboard.path}?machine=${encodeURIComponent(machine)}`;
  const editorHref = access?.manage_plugin && (currentDashboard || canCreateDashboard)
    ? dashboardEditorUrl + (currentDashboard ? `&dashboard=${encodeURIComponent(currentDashboard.dashboard)}` : '&create=1')
    : undefined;
  const editorLabel = currentDashboard ? 'Dashboard szerkesztése' : 'Dashboard hozzáadása';
  const editorIcon = currentDashboard ? 'pen' : 'plus';

  useEffect(() => {
    if (!mobile) {
      setChoosing(false);
    }
  }, [mobile]);

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

  const selectors = (
    <>
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
    </>
  );

  if (mobile) {
    return (
      <nav className={styles.mobileBar} aria-label="Monitoring navigáció">
        <HomeLink />
        <Button type="button" variant="secondary" icon="angle-down" className={styles.mobileChooser}
          aria-haspopup="dialog" aria-expanded={choosing}
          aria-label={selected?.name ? `Gép és dashboard kiválasztása, ${selected.name}` : 'Gép és dashboard kiválasztása'}
          onClick={() => setChoosing(true)}>
          <span className={styles.mobileMachine}>{selected?.name || 'Gép és dashboard'}</span>
        </Button>
        {editorHref && <LinkButton href={editorHref} variant="secondary" icon={editorIcon}
          aria-label={editorLabel} title={editorLabel} />}
        {choosing && (
          <Modal title="Gép és dashboard kiválasztása" isOpen onDismiss={() => setChoosing(false)}>
            <div className={styles.mobileSelectors}>{selectors}</div>
            <Modal.ButtonRow>
              <Button type="button" onClick={() => setChoosing(false)}>Kész</Button>
            </Modal.ButtonRow>
          </Modal>
        )}
      </nav>
    );
  }

  return (
    <nav className={styles.bar} aria-label="Monitoring navigáció">
      <div className={styles.controls}>
        <div className={styles.homeActions}>
          <HomeLink />
          {editorHref && (
            <LinkButton href={editorHref} icon={editorIcon} variant="secondary">{editorLabel}</LinkButton>
          )}
        </div>
        {selectors}
      </div>
      {selected?.name && <div className={styles.machineTitle} title={selected.name}>
        <span>{selected.name}</span>
      </div>}
    </nav>
  );
}
