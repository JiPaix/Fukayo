# Problèmes connus
## Toutes les plateformes
Le rechargements des modules à chaud (**H**ot **M**odule **R**eload) ne fonctionne que pour les changements à l'interieur du dossier renderer.
Les autres changements nécessite de redémarrer l'application.

## Windows
Dans certains cas le HMR crash.
Utiliser [build](setup-fr.md#build-et-start) à la place

## Linux
Si vous utiliser `nvm` and que vous ne pouvez pas commit à cause d'une erreur `npx command not found` ou `npx commande introuvable`:  
Editez le fichier `.git/hooks/pre-coomit` avec le contenu suivants **après avoir fait** `npm install`
```sh
#!/bin/sh
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
npx nano-staged
```