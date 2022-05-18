
const {readFileSync, writeFileSync} = require('fs');
const util = require('util');
const exec = util.promisify(require('child_process').exec);


/** @type {import('simple-git').default} */
const simpleGit = require('simple-git');




const args = process.argv.slice(2);

(async () => {

  try {
    await exec('git --version');
  } catch(e) {
    console.log('git binary not found');
    process.exit(1);
  }

  try {
    await exec('npm --version');
  } catch(e) {
    console.log('npm binary not found');
    process.exit(1);
  }

  try {
    const git = simpleGit();
    const branch = await git.branch();
    if(branch.current !== 'beta') throw new Error('Not on beta branch');
    if (args.length === 0) throw new Error('script must be run with one of these arguments --major, --minor or --patch');
    const {latest} = await git.tags({'v*-beta': null});
    if(!latest) throw new Error('Couldn\'t find latest tag');
    const res = await git.log();
    const latestTagCommit = res.all.find(r => r.refs.includes(`tag: ${latest}`));
    if(!latestTagCommit) throw new Error('Couldn\'t find latest tag in git history');
    const {total} = await git.log({from: latestTagCommit.hash, to: 'HEAD'});
    if(!total) throw new Error('Couldn\'t calculate number of commits since latest tag');

    const semantic = latest.replace('v', '').replace('-beta', '').split('.').map(v => parseInt(v));
    if(args[0] === '--major') {
      semantic[0]++;
      semantic[1] = 0;
      semantic[2] = 0;
    }
    else if(args[0] === '--minor') {
      semantic[1]++;
      semantic[2] = 0;
    }
    else if(args[0] === '--patch') semantic[2] = semantic[2] + total + 1;
    else return console.log('invalid arg');

    const oldVersion = latest.replace('-beta', '').replace('v', '');
    const newVersion = `${semantic.join('.')}`;
    const newPackage = readFileSync('./package.json').toString().replace(`"version": "${oldVersion}",`, `"version": "${newVersion}",`);
    if(args[1] === '--dry') return console.log(`Would update package.json from ${oldVersion} to ${newVersion}`);
    writeFileSync('./package.json', newPackage);
    const {stderr} = await exec('npm install');
    if(stderr) return console.log(stderr);
    await git.add(['./package.json', './package-lock.json']);
    await git.commit(`release: beta ${newVersion}`, ['./package.json', './package-lock.json']);
    await git.push();
  } catch(e) {
    console.error(e);
  }
})();



