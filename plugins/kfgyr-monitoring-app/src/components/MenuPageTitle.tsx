import React from 'react';
import type { IconName } from '@grafana/data';
import { css } from '@emotion/css';
import { Icon } from '@grafana/ui';

const styles = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  '& > svg': { flexShrink: 0 },
});

export function renderMenuPageTitle(icon: IconName) {
  return (title: string) => (
    <span className={styles}>
      <Icon name={icon} size="lg" aria-hidden />
      <span>{title}</span>
    </span>
  );
}
