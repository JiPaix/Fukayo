import type { PiniaCustomStateProperties, PiniaPluginContext, StateTree } from 'pinia';

function iterate(store: StateTree & PiniaCustomStateProperties<StateTree>, local: StateTree & PiniaCustomStateProperties<StateTree>) {
  Object.keys(store).forEach(key => {
    if (key === '__proto__' || key === 'constructor') return;
    if (typeof store[key] === 'object' && store[key] !== null && !Array.isArray(store[key])) {
      if(!local[key]) local[key] = {};
      return iterate(store[key], local[key]);
    }
    if(!local[key]) {
      local[key] = store[key];
    }
  });
  return local;
}

export function piniaLocalStorage(context: PiniaPluginContext) {
  if(typeof localStorage[context.store.$id] === 'undefined') {
    localStorage.setItem(context.store.$id, JSON.stringify(context.store.$state));
  } else {
    const local = JSON.parse(localStorage.getItem(context.store.$id) || '{}');
    const store = Object.assign(context.store.$state, {});

    const merge = iterate(store, local);
    context.store.$patch(merge);
  }
  context.store.$subscribe((mutation) => {
    localStorage.setItem(mutation.storeId, JSON.stringify(context.store.$state));
  });
}
