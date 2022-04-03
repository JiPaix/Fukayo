import type { PiniaPluginContext } from 'pinia';

export function piniaLocalStorage(context: PiniaPluginContext) {
  if(typeof localStorage[context.store.$id] === 'undefined') {
    localStorage.setItem(context.store.$id, JSON.stringify(context.store.$state));
  } else {
    context.store.$patch(JSON.parse(localStorage.getItem(context.store.$id) || '{}'));
  }
  context.store.$subscribe((mutation) => {
    console.log(`[🍍 ${mutation.storeId}]: ${mutation.type}.`);
    localStorage.setItem(mutation.storeId, JSON.stringify(context.store.$state));
  });
}
