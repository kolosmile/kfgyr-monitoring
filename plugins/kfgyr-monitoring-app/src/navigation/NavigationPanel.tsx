import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Icon, IconName, useStyles2 } from '@grafana/ui';

const links: Array<{ label: string; icon: IconName; path: string; adminOnly?: boolean }> = [
  { label: 'Gépmonitoring', icon: 'chart-line', path: '/d/kfgyr-machine-monitoring' },
  { label: 'Adatexport', icon: 'download-alt', path: '/a/kfgyr-monitoring-app/export' },
  { label: 'Agentek és gépek', icon: 'plug', path: '/a/kfgyr-monitoring-app/agents', adminOnly: true },
  { label: 'Monitoring beállítása', icon: 'cog', path: '/a/kfgyr-monitoring-app/profiles', adminOnly: true },
];

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({ height: '100%', overflow: 'auto' }),
  grid: css({
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, max(260px, 45%)), 1fr))',
    gap: theme.spacing(2),
    maxWidth: 1120,
    margin: '0 auto',
    padding: theme.spacing(2),
  }),
  card: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    minHeight: 116,
    padding: theme.spacing(2, 3),
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: 12,
    background: theme.colors.background.secondary,
    color: theme.colors.text.primary,
    fontSize: 19,
    fontWeight: theme.typography.fontWeightMedium,
    textDecoration: 'none',
    '&:hover': {
      background: theme.colors.action.hover,
      borderColor: theme.colors.border.strong,
      color: theme.colors.text.primary,
      textDecoration: 'none',
    },
    '&:focus-visible': { outline: `2px solid ${theme.colors.primary.main}`, outlineOffset: 2 },
  }),
  icon: css({
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
    width: 48,
    height: 48,
    borderRadius: 10,
    background: theme.colors.background.primary,
  }),
  arrow: css({ marginLeft: 'auto', flexShrink: 0, color: theme.colors.text.secondary }),
});

export function NavigationPanel() {
  const styles = useStyles2(getStyles);
  const isAdmin = config.bootData.user.isSignedIn && config.bootData.user.orgRole === 'Admin';

  return (
    <nav aria-label="KFGyR főmenü" className={styles.container}>
      <div className={styles.grid}>
        {links.filter(({ adminOnly }) => !adminOnly || isAdmin).map(({ label, icon, path }) => (
          <a key={path} className={styles.card} href={config.appSubUrl + path}>
            <span className={styles.icon}><Icon name={icon} size="xl" aria-hidden /></span>
            <span>{label}</span>
            <Icon name="angle-right" className={styles.arrow} aria-hidden />
          </a>
        ))}
      </div>
    </nav>
  );
}
