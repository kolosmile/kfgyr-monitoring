import React from 'react';
import { PluginPage } from '@grafana/runtime';
import { HomeLink } from '../components/HomeLink';
import { menu } from '../navigation/menu';

export function GuidePage() {
  return <PluginPage pageNav={menu.guide} actions={<HomeLink />}>{null}</PluginPage>;
}
