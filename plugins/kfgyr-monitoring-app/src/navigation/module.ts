import { PanelPlugin } from '@grafana/data';
import React from 'react';
import { NavigationPanel } from './NavigationPanel';
import { MonitoringMenu } from './MonitoringMenu';
import { menu } from './menu';
import { PanelProps } from '@grafana/data';

function Navigation(props: PanelProps<{ mode?: string }>) {
  return props.options.mode === 'monitoring' ? React.createElement(MonitoringMenu, props) : React.createElement(NavigationPanel);
}

export const plugin = new PanelPlugin(Navigation).setPanelOptions((builder) =>
  builder.addRadio({
    path: 'mode',
    name: 'Navigáció típusa',
    defaultValue: 'home',
    settings: { options: [
      { value: 'home', label: 'Kezdőlap' },
      { value: 'monitoring', label: menu.monitoring.text },
    ] },
  })
);
