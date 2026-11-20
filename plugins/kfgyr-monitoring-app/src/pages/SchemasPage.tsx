import React from 'react';
import { PluginPage, config } from '@grafana/runtime';
import { Button, LinkButton, useStyles2 } from '@grafana/ui';
import { HomeLink } from '../components/HomeLink';
import { MenuPageTitle } from '../components/MenuPageTitle';
import { getStyles } from '../components/styles';
import { menu } from '../navigation/menu';
import { SchemaManager } from './SchemaManager';

export function SchemasPage({ onBack }: { onBack?: () => void } = {}) {
  const styles = useStyles2(getStyles);

  return (
    <PluginPage pageNav={menu.schemas} renderTitle={() => null}>
      <div className={styles.page}>
        <MenuPageTitle item={menu.schemas} />
        <div className={styles.cardNavigation}>
          <HomeLink />
          {onBack ? (
            <Button type="button" variant="secondary" icon="arrow-left" onClick={onBack}>
              Vissza a panelszerkesztőhöz
            </Button>
          ) : (
            <LinkButton href={config.appSubUrl + menu.dashboard.path} variant="secondary" icon={menu.dashboard.icon}>
              {menu.dashboard.text}
            </LinkButton>
          )}
        </div>
        <SchemaManager />
      </div>
    </PluginPage>
  );
}
