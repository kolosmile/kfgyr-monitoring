import { useEffect, useState } from 'react';
import { config } from '@grafana/runtime';
import { api } from './api';

export type Access = {
  manage_plugin: boolean;
  manage_access: boolean;
  team_id?: number;
  team_name?: string;
};

const viewerAccess: Access = { manage_plugin: false, manage_access: false };

export function useAccess() {
  const signedIn = config.bootData.user.isSignedIn;
  const [access, setAccess] = useState<Access | undefined>(signedIn ? undefined : viewerAccess);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!signedIn) {
      return;
    }
    let active = true;
    api<Access>('access').then((result) => {
      if (active) {
        setAccess(result);
      }
    }).catch(() => {
      if (active) {
        setFailed(true);
        setAccess(viewerAccess);
      }
    });
    return () => { active = false; };
  }, [signedIn]);
  return { access, failed };
}
