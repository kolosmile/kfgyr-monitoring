import { createElement, useEffect, useSyncExternalStore } from 'react';
import { AppPlugin } from '@grafana/data';
import { config, locationService, PluginPage } from '@grafana/runtime';
import { Alert, Spinner } from '@grafana/ui';
import { ExportPage } from './pages/ExportPage';
import { ProfilesPage } from './pages/ProfilesPage';
import { SchemasPage } from './pages/SchemasPage';
import { App } from './pages/App';
import { ConnectionSettings } from './components/ConnectionSettings';
import { AccessPage } from './pages/AccessPage';
import { useAccess } from './access';
import { HomeLink } from './components/HomeLink';
import { menu } from './navigation/menu';

function subscribeToLocation(onChange: () => void) {
  return locationService.getHistory().listen(onChange);
}

function getPathname() {
  return locationService.getLocation().pathname;
}

function RedirectToHome() {
  useEffect(() => {
    window.location.replace(config.appSubUrl + '/d/kfgyr-home');
  }, []);
  return createElement(PluginPage, null, createElement(Spinner));
}

function AppRoot() {
  const pathname = useSyncExternalStore(subscribeToLocation, getPathname);
  const route = pathname.split('/').filter(Boolean).pop();
  const { access, failed } = useAccess();
  if (route === 'guide') {
    return createElement(RedirectToHome);
  }
  if (route === 'export' || route === 'kfgyr-monitoring-app') {
    return createElement(ExportPage);
  }
  if (!access) {
    return createElement(PluginPage, { children: createElement(Spinner) });
  }
  if (!access.manage_plugin || (route === 'access-management' && !access.manage_access)) {
    return createElement(PluginPage, { children: [
      createElement(Alert, { key: 'status', severity: failed ? 'error' : 'warning', title: failed
        ? 'A jogosultság nem ellenőrizhető'
        : 'Ehhez az oldalhoz nincs KFGyR jogosultságod.' }),
      createElement(HomeLink, { key: 'home' }),
    ] });
  }
  switch (route) {
    case 'export': return createElement(ExportPage);
    case 'profiles': return createElement(ProfilesPage);
    case 'schemas': return createElement(SchemasPage);
    case 'access-management': return createElement(AccessPage, {
      teamId: access.team_id, teamName: access.team_name ?? menu.access.text,
    });
    default: return createElement(App);
  }
}

export const plugin = new AppPlugin()
  .setRootPage(AppRoot)
  .addConfigPage({ title: 'Relay kapcsolat', id: 'connection', body: ConnectionSettings });
