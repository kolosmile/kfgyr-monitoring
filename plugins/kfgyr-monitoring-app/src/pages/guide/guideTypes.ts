import type { ReactNode } from 'react';
import type { IconName } from '@grafana/data';
import type { Access } from '../../access';

export type GuideRole = 'viewer' | 'operator' | 'admin';

export type GuideGroup = 'Bevezetés' | 'Gépek figyelése és adatok' | 'Rendszer beállítása' | 'Adminisztráció' | 'Segítség';

export const guideGroupOrder: GuideGroup[] = [
  'Bevezetés',
  'Gépek figyelése és adatok',
  'Rendszer beállítása',
  'Adminisztráció',
  'Segítség',
];

export type GuideChapter = {
  id: string;
  group: GuideGroup;
  title: string;
  shortTitle: string;
  icon: IconName;
  role: GuideRole;
  summary: string;
  keywords: string[];
  render: (access: Access, goTo: (id: string) => void) => ReactNode;
};

export function canSeeRole(role: GuideRole, access: Access): boolean {
  if (role === 'viewer') {
    return true;
  }
  if (role === 'operator') {
    return access.manage_plugin;
  }
  return access.manage_access;
}

export function currentRoleLabel(access: Access): string {
  if (access.manage_access) {
    return 'Adminisztrátor';
  }
  if (access.manage_plugin) {
    return 'KFGyR kezelő';
  }
  return 'Megtekintő (Viewer / vendég)';
}
