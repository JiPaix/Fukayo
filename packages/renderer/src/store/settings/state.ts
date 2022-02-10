/* eslint-disable semi */
export default interface Settings {
  count: number
  name: string
}


export const state = {
  count: 0,
  name: 'No name',
}

export type State = typeof state
