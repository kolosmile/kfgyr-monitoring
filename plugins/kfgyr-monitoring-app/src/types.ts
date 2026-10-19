export type Device = { id: string; alias: string; [key: string]: unknown };
export type Agent = {
  alias: string;
  url: string;
  retention?: string;
  ignore?: boolean;
  devices: Device[];
  [key: string]: unknown;
};
export type Setup = {
  client: { name: string; timezone: string; [key: string]: unknown };
  relay: { agents: Agent[]; [key: string]: unknown };
  [key: string]: unknown;
};
export type Snapshot = { revision: string; config: Setup; yaml: string };
export type RunnerStatus = {
  state?: string;
  revision?: string;
  requested_revision?: string;
  failed_revision?: string;
  message?: string;
  updated_at?: string;
  pid?: number;
};
export type FoundDevice = { id: string; name: string; uuid: string };

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export function errorText(error: unknown): string {
  const e = error as { status?: number; data?: { message?: string }; message?: string };
  if (e?.status === 409) {
    return 'A konfigurációt közben más is módosította. A saját változtatásaid megmaradtak ezen az oldalon. Újratöltés előtt jegyezd fel őket.';
  }
  return e?.data?.message || e?.message || 'A művelet nem sikerült. Próbáld újra.';
}

export const aliasPattern = /^[\p{L}\p{N}][\p{L}\p{N}_. -]{0,63}$/u;
export const retentionPattern = /^[1-9][0-9]{0,3}\s*(seconds?|minutes?|hours?|days?|weeks?|months?|years?)$/;

export function retentionLabel(value?: string): string {
  if (!value) {
    return 'Örökölt beállítás';
  }
  const match = value.match(/^([0-9]+)\s*(second|minute|hour|day|week|month|year)s?$/);
  const units: Record<string, string> = {
    second: 'másodperc',
    minute: 'perc',
    hour: 'óra',
    day: 'nap',
    week: 'hét',
    month: 'hónap',
    year: 'év',
  };
  return match ? `${match[1]} ${units[match[2]]}` : value;
}
