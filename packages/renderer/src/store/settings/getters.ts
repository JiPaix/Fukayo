import type { GetterTree } from 'vuex';
import type { State } from './state';

export type Getters = {
  nameWithMister(state: State): string
}

export const getters: GetterTree<State, State> & Getters = {
  nameWithMister: (state) => {
    return `Mr. ${state.name}`;
  },
};
