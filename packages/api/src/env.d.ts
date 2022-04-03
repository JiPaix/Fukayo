declare global {
  namespace NodeJS {
      interface ProcessEnv {
          USER_DATA: string,
          APP_DATA: string,
          TEMP_DATA: string,
          PICTURE_DATA: string,
          MODE: string
      }
  }
}
