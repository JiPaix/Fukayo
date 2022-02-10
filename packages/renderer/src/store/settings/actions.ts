import type { ActionTree, ActionContext } from 'vuex';
import type { State } from './state';
import { MutationTypes } from './mutations';
import type { Mutations } from './mutations';

type AugmentedActionContext = {
  commit<K extends keyof Mutations>(
    key: K,
    payload: Parameters<Mutations[K]>[1]
  ): ReturnType<Mutations[K]>
} & Omit<ActionContext<State, State>, 'commit'>


export enum ActionTypes {
  GET_NAME = 'GET_NAME',
}

export interface Actions {
  [ActionTypes.GET_NAME](
    { commit }: AugmentedActionContext,
    payload: string
  ): Promise<string>
}

export const actions: ActionTree<State, State> & Actions = {
  [ActionTypes.GET_NAME]({ commit }, payload) {
    return new Promise((resolve) => {
      setTimeout(() => {
        commit(MutationTypes.SET_NAME, payload);
        resolve(payload);
      }, 500);
    });
  },
};

