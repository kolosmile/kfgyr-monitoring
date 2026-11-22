import type { IconName } from '@grafana/data';

type MenuItem = { text: string; icon: IconName; path: string };

const app = '/a/kfgyr-monitoring-app';

export const menu = {
  monitoring: { text: 'Monitoring', icon: 'chart-line', path: '/d/kfgyr-machine-monitoring' },
  fleet: { text: 'Géppark', icon: 'apps', path: '/d/kfgyr-fleet' },
  export: { text: 'Adatexport', icon: 'download-alt', path: app + '/export' },
  agents: { text: 'Agentek és gépek', icon: 'plug', path: app + '/agents' },
  dashboard: { text: 'Dashboard szerkesztő', icon: 'sliders-v-alt', path: app + '/profiles' },
  schemas: { text: 'Jelkatalógus', icon: 'sitemap', path: app + '/schemas' },
  access: { text: 'Jogosultságkezelés', icon: 'users-alt', path: app + '/access-management' },
  guide: { text: 'Használati útmutató', icon: 'book-open', path: app + '/guide' },
} satisfies Record<string, MenuItem>;

export const signalCatalogIcon = menu.schemas.icon;
