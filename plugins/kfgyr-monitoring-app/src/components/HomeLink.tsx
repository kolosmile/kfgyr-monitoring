import React from 'react';
import { config } from '@grafana/runtime';
import { LinkButton } from '@grafana/ui';

export function HomeLink() {
  return (
    <LinkButton href={config.appSubUrl + '/d/kfgyr-home'} icon="home-alt" variant="secondary">
      Kezdőlap
    </LinkButton>
  );
}
