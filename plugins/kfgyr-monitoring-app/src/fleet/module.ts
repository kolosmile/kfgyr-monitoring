import { PanelPlugin } from '@grafana/data';
import { FleetPanel } from './FleetPanel';

export const plugin = new PanelPlugin(FleetPanel);
