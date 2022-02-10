import type { MutationTree } from 'vuex';
import type { State } from './state';


export enum MutationTypes {
  SET_NAME = 'SET_NAME',
}

export type Mutations<S = State> = {
  [MutationTypes.SET_NAME](state: S, payload: string): void
}

export const mutations: MutationTree<State> & Mutations = {
  [MutationTypes.SET_NAME](state, payload: string) {
    state.name = payload;
  },
};
