import { AppPlugin } from '@grafana/data';
import { App } from './pages/App';
import { ConnectionSettings } from './components/ConnectionSettings';
export const plugin = new AppPlugin()
  .setRootPage(App)
  .addConfigPage({ title: 'Relay kapcsolat', id: 'connection', body: ConnectionSettings });
