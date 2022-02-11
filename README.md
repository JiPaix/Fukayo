# Who does what
## Workflow

<details>
  <summary>
    Gitflow Workflow
  </summary>

![gitflow](workflow.png)
### Beta Branch
:warning: :fire: **To deploy a new pre-release make sure the targeted version is higher than both the current `beta` and `main` branch version.**

- Pushing commits and merges
  - CI won't run tests
  - Deploy a pre-release if package.json version is incremented
- Submit PR
  - CI will run tests to check pull request
- Accept PR
  - Changes are merged
  - Deploy a pre-release if package.json version is incremented
### Main Branch
:warning: :fire: **This branch must be updated through PRs <u>from beta branch AND the same repo</u> only**, not doing this could results in tons of conflict between both branches

- Pushing commits and merges
  - :shit: DON'T!
- Accept/Submit PR from a fork
  - :shit: DON'T!
- Submit PR from JiPaix/beta to JiPaix/main
  - Ci will run tests to check pull requests
- Accept PR from JiPaix/beta to JiPaix/main
  - Changes are merged
  - Deploy a pre-release if package.json version is incremented
  - Beta branch is updated (fast-forward) to include merge commit

</details>
<details>
  <summary>
    CI: explaining Github Actions
  </summary>

#### lint.yml
- Description: Linting
- Actions:
  - Runs: `eslint . --ext js,ts,vue`

#### release.yml
- Description: Release new version
- Actions:
  - Check if target version in package.json is `!=` from current version
  - Generate changelog using `.github/actions/release-notes/main.js`
  - Remove outdated draft releases
  - Create new Draft releases
  - Build and upload artifacts (windows and linux)
  - Publish release
  - Fast forward beta branch

#### release-beta.yml
- Description: Release new version
- Actions:
  - Check if target version in package.json is `!=` from current version
  - Add `-beta` suffix to target version
  - Generate changelog using `.github/actions/release-notes/main.js`
  - Remove outdated draft prereleases
  - Create new Draft prereleases
  - Build and upload artifacts (windows and linux)
  - Publish prerelease

#### tests.yml
- Description: Test the Application
- Actions:
  - Test the Electron process `main` 
  - Test the Electron preloader `preload` 
  - Test Vue components `renderer`
  - End-To-End testing `e2e`
#### typechecking.yml
- Description: TypeScript testing
  - runs typecheck on `main`, `preload` and `renderer`

</details>
