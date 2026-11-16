import { PanelPlugin } from '@grafana/data';
import React from 'react';
import { NavigationPanel } from './NavigationPanel';
import { MonitoringMenu } from './MonitoringMenu';
import { PanelProps } from '@grafana/data';

function Navigation(props: PanelProps<{ mode?: string }>) {
  return props.options.mode === 'monitoring' ? React.createElement(MonitoringMenu, props) : React.createElement(NavigationPanel);
}

export const plugin = new PanelPlugin(Navigation);
