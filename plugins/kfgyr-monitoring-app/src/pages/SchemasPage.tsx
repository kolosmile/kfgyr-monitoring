import React from 'react';
import { PluginPage, config } from '@grafana/runtime';
import { Button, LinkButton, useStyles2 } from '@grafana/ui';
import { HomeLink } from '../components/HomeLink';
import { getStyles } from '../components/styles';
import { menu } from '../navigation/menu';
import { SchemaManager } from './SchemaManager';

export function SchemasPage({ onBack }: { onBack?: () => void } = {}) {
  const styles = useStyles2(getStyles);

  return (
    <PluginPage pageNav={menu.schemas} actions={(
      <div className={styles.actions}>
        {onBack ? (
          <Button type="button" variant="secondary" icon="arrow-left" onClick={onBack}>
            Vissza a panelszerkesztőhöz
          </Button>
        ) : (
          <LinkButton href={config.appSubUrl + menu.dashboard.path} variant="secondary" icon={menu.dashboard.icon}>
            {menu.dashboard.text}
          </LinkButton>
        )}
        <HomeLink />
      </div>
    )}>
      <div className={styles.page}><SchemaManager /></div>
    </PluginPage>
  );
}
