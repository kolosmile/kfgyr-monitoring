import { getBackendSrv } from '@grafana/runtime';
import { lastValueFrom } from 'rxjs';

export type RunnerApi = <T>(path: string, method?: string, data?: unknown) => Promise<T>;
export const api: RunnerApi = async <T>(path: string, method = 'GET', data?: unknown): Promise<T> => {
  const result = await lastValueFrom(
    getBackendSrv().fetch<T>({
      url: `/api/plugins/kfgyr-monitoring-app/resources/${path}`,
      method,
      data,
      showErrorAlert: false,
    })
  );
  return result.data;
};
