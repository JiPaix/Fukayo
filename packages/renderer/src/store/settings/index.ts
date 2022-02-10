import type {
  Store as VuexStore,
  CommitOptions,
  DispatchOptions} from 'vuex';
import {
  createStore,
} from 'vuex';

import type { State } from './state';
import { state } from './state';
import type { Getters} from './getters';
import { getters } from './getters';
import type { Mutations} from './mutations';
import { mutations } from './mutations';
import type { Actions } from './actions';
import { actions } from './actions';
import type { InjectionKey } from 'vue';

export const store = createStore({
  state,
  getters,
  mutations,
  actions,
});

export type Store = Omit<
  VuexStore<State>,
  'getters' | 'commit' | 'dispatch'
> & {
  commit<K extends keyof Mutations, P extends Parameters<Mutations[K]>[1]>(
    key: K,
    payload: P,
    options?: CommitOptions
  ): ReturnType<Mutations[K]>
} & {
  dispatch<K extends keyof Actions>(
    key: K,
    payload: Parameters<Actions[K]>[1],
    options?: DispatchOptions
  ): ReturnType<Actions[K]>
} & {
  getters: {
    [K in keyof Getters]: ReturnType<Getters[K]>
  }
}

export function useStore() {
  return store as Store;
}

export const key: InjectionKey<VuexStore<State>> = Symbol();
