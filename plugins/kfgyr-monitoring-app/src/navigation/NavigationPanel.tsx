import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Icon, useStyles2 } from '@grafana/ui';
import { menu } from './menu';
import { useAccess } from '../access';

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({ height: '100%', overflow: 'auto' }),
  list: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    maxWidth: 720,
    margin: '0 auto',
    padding: theme.spacing(2),
  }),
  title: css({
    margin: theme.spacing(1, 0, 1.5),
    color: theme.colors.text.primary,
    fontSize: 32,
    lineHeight: 1.15,
    fontWeight: theme.typography.fontWeightBold,
    '@media (max-width: 600px)': { fontSize: 26 },
  }),
  tools: css({ '--menu-accent': theme.isDark ? '#91b9ea' : '#325e94' }),
  settings: css({ '--menu-accent': theme.isDark ? '#c3aae4' : '#6c478a' }),
  docs: css({ '--menu-accent': theme.isDark ? '#8ec6b4' : '#326d5d' }),
  heading: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    margin: theme.spacing(0, 0, 1),
    color: 'var(--menu-accent)',
    fontSize: 14,
    '&::after': { content: '""', flex: 1, borderTop: `1px solid ${theme.colors.border.weak}` },
  }),
  cards: css({ display: 'flex', flexDirection: 'column', gap: theme.spacing(0.75) }),
  card: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    minHeight: 54,
    padding: theme.spacing(0.75, 2),
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: 12,
    background: theme.colors.background.secondary,
    color: theme.colors.text.primary,
    fontSize: 16,
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
    width: 36,
    height: 36,
    borderRadius: 10,
    background: theme.colors.background.primary,
    color: 'var(--menu-accent)',
  }),
  arrow: css({ marginLeft: 'auto', flexShrink: 0, color: theme.colors.text.secondary }),
});

export function NavigationPanel() {
  const styles = useStyles2(getStyles);
  const { access } = useAccess();
  const groups = [
    { title: 'Eszközök', accent: 'tools', items: [menu.monitoring, menu.fleet, menu.export] },
    { title: 'Beállítások', accent: 'settings', items: access?.manage_plugin
      ? [menu.agents, menu.dashboard, menu.schemas, ...(access.manage_access ? [menu.access] : [])] : [] },
    { title: 'Dokumentáció', accent: 'docs', items: access?.manage_plugin ? [menu.guide] : [] },
  ] as const;

  return (
    <nav aria-label="KFGyR főmenü" className={styles.container}>
      <div className={styles.list}>
        <h1 className={styles.title}>Gyártórendszer Monitoring</h1>
        {groups.filter(({ items }) => items.length > 0).map(({ title, accent, items }) => (
          <section key={accent} aria-labelledby={`kfgyr-menu-${accent}`} className={styles[accent]}>
            <h2 id={`kfgyr-menu-${accent}`} className={styles.heading}>{title}</h2>
            <div className={styles.cards}>
              {items.map(({ text, icon, path }) => (
                <a key={path} className={styles.card} href={config.appSubUrl + path}>
                  <span className={styles.icon}><Icon name={icon} size="lg" aria-hidden /></span>
                  <span>{text}</span>
                  <Icon name="angle-right" className={styles.arrow} aria-hidden />
                </a>
              ))}
            </div>
          </section>
        ))}
      </div>
    </nav>
  );
}
