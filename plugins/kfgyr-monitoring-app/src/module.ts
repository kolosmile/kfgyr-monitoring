import { createElement } from 'react';
import { AppPlugin } from '@grafana/data';
import { ExportPage } from './pages/ExportPage';
import { ProfilesPage } from './pages/ProfilesPage';
import { App } from './pages/App';
import { ConnectionSettings } from './components/ConnectionSettings';
export const plugin = new AppPlugin()
  .setRootPage(() => {
    const page = window.location.pathname.split('/').filter(Boolean).pop();
    if (page === 'export') {
      return createElement(ExportPage);
    }
    if (page === 'profiles') {
      return createElement(ProfilesPage);
    }
    return createElement(App);
  })
  .addConfigPage({ title: 'Relay kapcsolat', id: 'connection', body: ConnectionSettings });
