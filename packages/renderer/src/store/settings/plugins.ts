import type { Store } from './';
import { MutationTypes } from './mutations';

const userDataPath = (store:Store) => {
  window.userDataPath().then(userPath => {
    store.commit(MutationTypes.SET_USERDATAPATH, userPath);
  });
};

export const plugins = [userDataPath];
