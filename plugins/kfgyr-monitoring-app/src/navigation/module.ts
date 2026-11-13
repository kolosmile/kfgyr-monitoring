import { PanelPlugin } from '@grafana/data';
import { NavigationPanel } from './NavigationPanel';

export const plugin = new PanelPlugin(NavigationPanel);
