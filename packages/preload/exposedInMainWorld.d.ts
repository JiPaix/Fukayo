interface Window {
    /**
     * Expose Environment versions.
     * @example
     * console.log( window.versions )
     */
    readonly versions: NodeJS.ProcessVersions;
    /**
     * Expose the user data path.
     * intended to be used in a vuex store plugin
     */
    readonly getPath: (path: import('./src/config').Paths) => Promise<string>;
    readonly apiServer: {
      startServer: (payload: import('../api/src/app/types').startPayload) => Promise<import('../api/src/app/types').ForkResponse>;
      stopServer: () => Promise<import('../api/src/app/types').ForkResponse>;
      copyImageToClipboard: (string: string) => Promise<any>;
      getEnv: string;
    };
}
