import { createElement, useSyncExternalStore } from 'react';
import { AppPlugin } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { ExportPage } from './pages/ExportPage';
import { ProfilesPage } from './pages/ProfilesPage';
import { SchemasPage } from './pages/SchemasPage';
import { GuidePage } from './pages/GuidePage';
import { App } from './pages/App';
import { ConnectionSettings } from './components/ConnectionSettings';

function subscribeToLocation(onChange: () => void) {
  return locationService.getHistory().listen(onChange);
}

function getPathname() {
  return locationService.getLocation().pathname;
}

function AppRoot() {
  const pathname = useSyncExternalStore(subscribeToLocation, getPathname);
  switch (pathname.split('/').filter(Boolean).pop()) {
    case 'export': return createElement(ExportPage);
    case 'profiles': return createElement(ProfilesPage);
    case 'schemas': return createElement(SchemasPage);
    case 'guide': return createElement(GuidePage);
    default: return createElement(App);
  }
}

export const plugin = new AppPlugin()
  .setRootPage(AppRoot)
  .addConfigPage({ title: 'Relay kapcsolat', id: 'connection', body: ConnectionSettings });
