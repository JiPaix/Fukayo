import type { PiniaPluginContext } from 'pinia';

export function piniaLocalStorage(context: PiniaPluginContext) {
  context.store.$patch(JSON.parse(localStorage.getItem(context.store.$id) || '{}'));
  context.store.$subscribe((mutation) => {
    localStorage.setItem(mutation.storeId, JSON.stringify(context.store.$state));
  });
}
