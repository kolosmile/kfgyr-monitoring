import React from 'react';
import type { GrafanaTheme2, IconName } from '@grafana/data';
import { config } from '@grafana/runtime';
import { css } from '@emotion/css';
import { Icon, useStyles2 } from '@grafana/ui';
import { menu } from '../navigation/menu';

const getStyles = (theme: GrafanaTheme2) => ({
  row: css({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    margin: '0 0 20px',
  }),
  title: css({
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    margin: 0,
    minWidth: 0,
    fontSize: 'clamp(2rem, 4vw, 2.5rem)',
    lineHeight: 1.15,
    fontWeight: 700,
    '& > svg': { flexShrink: 0 },
  }),
  guideLink: css({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    padding: 6,
    borderRadius: theme.shape.radius.default,
    background: 'transparent',
    border: 'none',
    color: theme.colors.text.secondary,
    textDecoration: 'none',
    cursor: 'pointer',
    transition: 'color 120ms ease',
    '&:hover': {
      color: theme.colors.text.primary,
      background: 'transparent',
    },
    '&:focus-visible': {
      color: theme.colors.text.primary,
      outline: `2px solid ${theme.colors.primary.border}`,
      outlineOffset: 2,
    },
  }),
});

export function MenuPageTitle({ item }: { item: { text: string; icon: IconName; guideChapter?: string } }) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.row}>
      <h1 className={styles.title}>
        <Icon name={item.icon} size="xxl" aria-hidden />
        <span>{item.text}</span>
      </h1>
      {item.guideChapter && (
        <a
          className={styles.guideLink}
          href={`${config.appSubUrl}${menu.guide.path}#${item.guideChapter}`}
          title="Használati útmutató"
          aria-label={`${item.text} – Használati útmutató`}
        >
          <Icon name="info-circle" size="xl" aria-hidden />
        </a>
      )}
    </div>
  );
}
