export type TaskDone = {
  done: boolean;
}

export type mirrorInfo = {
  name:string,
  displayName: string,
  host:string,
  enabled:boolean,
  icon:string,
  langs:string[],
  options?: Record<string, unknown>
}
