import React from 'react';
import { PluginPage } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
import { HomeLink } from '../components/HomeLink';
import { MenuPageTitle } from '../components/MenuPageTitle';
import { getStyles } from '../components/styles';
import { menu } from '../navigation/menu';

export function GuidePage() {
  const styles = useStyles2(getStyles);
  return (
    <PluginPage pageNav={menu.guide} renderTitle={() => null}>
      <div className={styles.page}>
        <MenuPageTitle item={menu.guide} />
        <HomeLink />
      </div>
    </PluginPage>
  );
}
