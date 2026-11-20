import React from 'react';
import type { IconName } from '@grafana/data';
import { css } from '@emotion/css';
import { Icon } from '@grafana/ui';

const styles = css({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  margin: '0 0 20px',
  fontSize: 'clamp(2rem, 4vw, 2.5rem)',
  lineHeight: 1.15,
  fontWeight: 700,
  '& > svg': { flexShrink: 0 },
});

export function MenuPageTitle({ item }: { item: { text: string; icon: IconName } }) {
  return (
    <h1 className={styles}>
      <Icon name={item.icon} size="xxl" aria-hidden />
      <span>{item.text}</span>
    </h1>
  );
}
