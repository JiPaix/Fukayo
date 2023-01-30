# Known issues
## All plateforms
Hot module reload ONLY watches changes in renderer package.  
Changes to other packages requires to restart the app.

## Windows
Hot module reload (HMR) randomly crashes in some cases.
use [build and start](setup.md#build-and-start) instead

## Linux
If you are using `nvm` and cannot commit because of error `npx command not found`:  
edit the file located in `.git/hooks/pre-commit` with this content **after you've run** `npm install`
```sh
#!/bin/sh
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
npx nano-staged
```