import React from 'react';
import { PluginPage, config } from '@grafana/runtime';
import { LinkButton, useStyles2 } from '@grafana/ui';
import { HomeLink } from '../components/HomeLink';
import { getStyles } from '../components/styles';
import { menu } from '../navigation/menu';
import { SchemaManager } from './SchemaManager';

export function SchemasPage() {
  const styles = useStyles2(getStyles);

  return (
    <PluginPage pageNav={menu.schemas} actions={(
      <div className={styles.actions}>
        <LinkButton href={config.appSubUrl + menu.dashboard.path} variant="secondary" icon={menu.dashboard.icon}>
          {menu.dashboard.text}
        </LinkButton>
        <HomeLink />
      </div>
    )}>
      <div className={styles.page}><SchemaManager /></div>
    </PluginPage>
  );
}
