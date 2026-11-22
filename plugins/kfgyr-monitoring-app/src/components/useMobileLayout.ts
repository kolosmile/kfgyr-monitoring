import { useSyncExternalStore } from 'react';

const mobileQuery = '(max-width: 767px)';

function subscribe(listener: () => void) {
  const media = window.matchMedia(mobileQuery);
  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
}

export function useMobileLayout() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(mobileQuery).matches, () => false);
}
