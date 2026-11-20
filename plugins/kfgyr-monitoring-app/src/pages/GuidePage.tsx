import React from 'react';
import { PluginPage } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
import { HomeLink } from '../components/HomeLink';
import { getStyles } from '../components/styles';
import { menu } from '../navigation/menu';

export function GuidePage() {
  const styles = useStyles2(getStyles);
  return (
    <PluginPage pageNav={menu.guide}>
      <div className={styles.page}><HomeLink /></div>
    </PluginPage>
  );
}
