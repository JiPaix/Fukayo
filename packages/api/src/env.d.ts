export {};
declare global {
  namespace NodeJS {
      interface ProcessEnv {
        ELECTRON_RUN_AS_NODE?: string;
        /** Server's login */
        LOGIN:string,
        /** Server's password */
        PASSWORD:string,
        /** Server's port */
        PORT:string,
        /**
         * Server's url
         *
         * ONLY USE WHEN `env.SSL = 'app'`
         *
         * @example "https://localhost"
         * @example "https://my-server.com"
         */
        HOSTNAME?: string,
        /**
         * SSL MODE
         *
         * - Provide your own SSL certificate and key: `env.SSL = 'provided'`
         *   - needs `env.CERT` and `env.KEY`
         * - Generate a self-signed certificate and use it: `env.SSL = 'app'`
         *   - needs `env.HOSTNAME`
         * - No SSL (http): `env.SSL = 'false'`
         */
        SSL: 'false' | 'app' | 'provided',
        /**
         * SSL certificate string or path
         *
         * path is prefered when API is standalone
         */
        CERT?: string,
        /**
         * SSL key string or path
         *
         * path is prefered when API is standalone
         */
        KEY?: string,
        /**
         *  Path to stored data (config, cache, certificates, etc.)
         *
         * optional: default is `__dirname/user_data`
         * @example "C:\\Users\\user\\config\\electron-mangas-reader"
         * @example "/home/user/config/electron-mangas-reader"
        */
        USER_DATA: string,

        /** Path to the HTML template */
        VIEW:string
        /**
         * Path to downloaded manga's chapters
         *
         * @example "C:\\Users\\user\\pictures"
         * @example "/home/user/pictures"
         */
        DOWNLOAD_DATA: string,
        /** `"production"` or `"development"` (optional) */
        MODE?: string,
      }
  }
}
