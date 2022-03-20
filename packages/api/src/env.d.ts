declare global {
  namespace NodeJS {
      interface ProcessEnv {
           PASSWORD?: string;
           USER_PATH: string,
           PORT: string,
           MODE: string
      }
  }
}
