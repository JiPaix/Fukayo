import type {Store} from 'vuex';

export function localStorage<T>(store:Store<T & { storeName: string}>) {
  const data = window.localStorage.getItem(store.state.storeName);

  if(data) {
    store.replaceState(JSON.parse(data));
  }

  store.subscribe((mutation, state) => {
    window.localStorage.setItem(state.storeName, JSON.stringify(state));
  });
}
