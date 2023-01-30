# Meta
## Commits
### Utiliser les [conventional commits](https://www.conventionalcommits.org/en/v1.0.0/)
#### [liste des scopes disponible](https://github.com/JiPaix/Fukayo/blob/731e55cb3780ed30d93def29705cf7db1094b672/.vscode/settings.json#L25-L41)
Exemples:
- `fix(api): that didn't do this`
- `feat(renderer): add that in here`
- `chore(deps): update this`

**Les non-devs doivent être en capacité de comprendre le message de commit**  
Si vous avez besoin de rentrer dans le détail technique utiliser le body du commit:
```text
fix(mirrors): mangadex

fix infinite loop in recommend()
replaced XXX by YYY
```
## Pull requests
- Les titres de PRs doivent ressembler a des commits
- Ne pas ouvrir de PR sur la branche `main`
## CHANGELOG
Le Changelog est automatiquement généré en utilisant les messages des commits.
# Overview
## Structure des dossiers
### i18n
- Dossier: `/packages/i18n/src`
- Détection des locales/async loader, convertisseur `BC47`, `3166-1 ALPHA2` vers `639-1` (custom)
### Main
- Dossier: `/packages/main/src`   
- contient le code d'Electron, les fenêtres, icone de la bare des tâches...
### API
- Dossier: `/packages/api/src`   
- databases, sources, web server, socket server, file server.. etc.
### Renderer
- Dossier: `/packages/renderer/src`   
- Les vues, le router et les stores.