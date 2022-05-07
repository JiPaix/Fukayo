export {};
declare global {
  namespace NodeJS {
      interface ProcessEnv {
        USER_DATA: string,
        PICTURE_DATA: string,
        DOWNLOAD_DATA: string,
        LOGIN?:string,
        PASSWORD?:string,
        MODE?: string,
      }
  }
}
