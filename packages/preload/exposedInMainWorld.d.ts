interface Window {
    /**
     * Expose Environment versions.
     * @example
     * console.log( window.versions )
     */
    readonly versions: NodeJS.ProcessVersions;
     /**
      * Expose the user data path.
      * intended to be used in a vuex Store plugin
      */
      readonly userData : { configPath:() => Promise<string>; };
      readonly apiServer: {
        startServer: (port: number, password:string) => Promise<{ type: string, success: boolean, message: string }>;
        stopServer: () => Promise<{ type: string, success: boolean, message: string }>;
      };
}
