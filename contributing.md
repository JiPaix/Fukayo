# Contributing

First and foremost, thank you! We appreciate that you want to contribute to Electron Mangas Reader, your time is valuable, and your contributions mean a lot to us.

## Contribution Guidelines
- Your contribution(s) must comply with our [Code of Conduct](CODE_OF_CONDUCT.md)
- Simple and descriptive commit message, as they appear in the changelog _anybody_* should be able to understand what it's about.
  - Treat commits as PRs, 1 commit = 1 feature/fix 
- Do not submit PRs to the main branch
- Before submitting a PR test your changes
  - Changes on packages `main` and `renderer` must be tested on both windows and linux
  - Changes to package renderer must be tested in and outside the electron environment

*developers and end users

## Repo Setup

1. Clone repo
1. `npm install` install dependencies
1. `npm run watch` start electron app in watch mode.
1. `npm run compile` build app but for local debugging only.
1. `npm run lint` lint your code.
1. `npm run typecheck` Run typescript check.
1. `npm run test` Run app test.

## Tree
The root folder contains config files, build ressources/scripts and tests,  
the main part code is located at `/AMR/packages`
- `/AMR/packages/main/src`
  - `index.ts` electron startup
  - `mainWindow.ts` create main window
  - `forkAPI.ts` api to communicate with fork process 
- `/AMR/packages/api/src`
  - `/app` api starter
  - `/client` a client to communicate with the api via socket.io
  - `/server` server handling socket.io commands
  - `/models` source/mirrors implementations
  - `/db` databases used by the server and the models
  - `/utils`
    - `certificate.ts` SSL certificate generator
    - `crawler.ts` headless browser to fetch data
    - `standalone.ts` check the env if the api is used outside electron
  - `/AMR/packages/renderer/src`
    - `/store` pinia stores
    - `/locales` internationalization files
    - `/components` Vue components
