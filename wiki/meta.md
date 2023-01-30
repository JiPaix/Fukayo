# Meta
## Commits
### Use [conventional commits](https://www.conventionalcommits.org/en/v1.0.0/)
#### [list of available scopes](https://github.com/JiPaix/Fukayo/blob/731e55cb3780ed30d93def29705cf7db1094b672/.vscode/settings.json#L25-L41)
Examples:
- `fix(api): that didn't do this`
- `feat(renderer): add that in here`
- `chore(deps): update this`

**Non-devs must be able to grasp what the commit is about**  
if you need to get technical please use the commit body:
```text
fix(mirrors): mangadex

fix infinite loop in recommend()
replaced XXX by YYY
```
## Pull requests
- Treat PRs titles as commits
- Do not open PR on branch `main`
## CHANGELOG
Changelogs are automatically generated using commits messages.
# Overview
## Folder Structure
### i18n
- Location: `/packages/i18n/src`
- locales detector/async loader, convert `BC47`, `3166-1 ALPHA2` to `639-1` (custom)
### Main
- Location: `/packages/main/src`   
- contains electron's code, windows, systray icon..
### API
- Location: `/packages/api/src`   
- databases, mirrors, web server, socket server, file server.. etc.
### Renderer
- Location: `/packages/renderer/src`   
- Views, router, stores