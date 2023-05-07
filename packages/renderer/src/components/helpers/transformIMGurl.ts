import type { useStore as useSettingsStore } from '@renderer/stores/settings';

/** make sure we get the right url */
export function transformIMGurl(url: string, settings:ReturnType<typeof useSettingsStore>) {
  const isElectron = typeof window.apiServer !== 'undefined' ? true : false;
  // return the url as is if it's external (http, https)
  if(url.startsWith('http') || url.startsWith('https')) return url;
  // remove leading slash if it's present
  if(url.startsWith('/')) url = url.substring(1);
  // in dev mode the protocol and port of the file server are different from the current page
  if(isElectron) return `${settings.server.ssl === 'false' ? 'http' : 'https'}://127.0.0.1:${settings.server.port}/${url}?token=${settings.server.accessToken}`;
  return `${settings.server.ssl === 'false' ? 'http' : 'https'}://${location.hostname}:${settings.server.port}/${url}?token=${settings.server.accessToken}`;
}
