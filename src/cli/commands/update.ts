/**
 * K.I.T. Update CLI Command
 * 
 * Self-update K.I.T. to the latest version.
 * 
 * @see OpenClaw docs/update.md
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Command } from 'commander';
import { execSync, spawn } from 'child_process';
import https from 'https';

const KIT_HOME = path.join(os.homedir(), '.kit');
const GITHUB_REPO = 'kayzaa/k.i.t.-bot';
const NPM_PACKAGE = 'kit-trading';
const VERSION = '2.0.0';

export function registerUpdateCommand(program: Command): void {
  program
    .command('update')
    .description('Update K.I.T. to the latest version')
    .option('--check', 'Only check for updates, don\'t install')
    .option('--force', 'Force update even if already on latest')
    .option('--pre', 'Include pre-release versions')
    .option('--from-git', 'Update from GitHub instead of npm')
    .action(async (options) => {
      console.log('🔍 Checking for updates...\n');
      
      try {
        if (options.fromGit) {
          await updateFromGit(options);
        } else {
          await updateFromNpm(options);
        }
      } catch (error: any) {
        console.error(`❌ Update failed: ${error.message}`);
        process.exit(1);
      }
    });
}

async function updateFromNpm(options: any): Promise<void> {
  // Get latest version from npm
  const latestVersion = await getLatestNpmVersion();
  
  console.log(`Current version: ${VERSION}`);
  console.log(`Latest version:  ${latestVersion}`);
  
  if (VERSION === latestVersion && !options.force) {
    console.log('\n✅ Already on the latest version!');
    return;
  }
  
  if (options.check) {
    if (VERSION !== latestVersion) {
      console.log(`\n💡 Update available! Run: kit update`);
    }
    return;
  }
  
  console.log('\n📦 Updating via npm...\n');
  
  try {
    // Determine if global or local install
    const isGlobal = process.execPath.includes('npm') || 
                     process.execPath.includes('node_modules');
    
    const cmd = isGlobal 
      ? `npm install -g ${NPM_PACKAGE}@latest`
      : `npm install ${NPM_PACKAGE}@latest`;
    
    console.log(`Running: ${cmd}\n`);
    
    execSync(cmd, { stdio: 'inherit' });
    
    console.log('\n✅ Update complete!');
    console.log('💡 Restart K.I.T. to use the new version: kit start');
  } catch {
    console.error('\n⚠️ npm update failed. Try manually:');
    console.log(`   npm install -g ${NPM_PACKAGE}@latest`);
  }
}

async function updateFromGit(options: any): Promise<void> {
  // Get latest tag from GitHub
  const latestTag = await getLatestGitTag();
  
  console.log(`Current version: ${VERSION}`);
  console.log(`Latest tag:      ${latestTag || 'unknown'}`);
  
  if (options.check) {
    if (latestTag && `v${VERSION}` !== latestTag) {
      console.log(`\n💡 Update available! Run: kit update --from-git`);
    } else {
      console.log('\n✅ Already on the latest version!');
    }
    return;
  }
  
  // Find the installation directory
  const installDir = findInstallDir();
  
  if (!installDir) {
    console.error('\n⚠️ Could not find K.I.T. installation directory.');
    console.log('   Try updating via npm: kit update');
    return;
  }
  
  console.log(`\n📂 Installation directory: ${installDir}`);
  console.log('🔄 Pulling latest changes...\n');
  
  try {
    // Change to install directory and pull
    process.chdir(installDir);
    
    execSync('git pull', { stdio: 'inherit' });
    
    console.log('\n📦 Installing dependencies...\n');
    execSync('npm install', { stdio: 'inherit' });
    
    console.log('\n🔨 Building...\n');
    execSync('npm run build', { stdio: 'inherit' });
    
    console.log('\n✅ Update complete!');
    console.log('💡 Restart K.I.T. to use the new version: kit start');
  } catch (error: any) {
    console.error(`\n❌ Git update failed: ${error.message}`);
    console.log('\nTry manually:');
    console.log(`   cd ${installDir}`);
    console.log('   git pull && npm install && npm run build');
  }
}

async function getLatestNpmVersion(): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(`https://registry.npmjs.org/${NPM_PACKAGE}/latest`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const pkg = JSON.parse(data);
          resolve(pkg.version || VERSION);
        } catch {
          resolve(VERSION);
        }
      });
    }).on('error', () => resolve(VERSION));
  });
}

async function getLatestGitTag(): Promise<string | null> {
  return new Promise((resolve) => {
    https.get({
      hostname: 'api.github.com',
      path: `/repos/${GITHUB_REPO}/tags`,
      headers: { 'User-Agent': 'K.I.T.' },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const tags = JSON.parse(data);
          if (Array.isArray(tags) && tags.length > 0) {
            resolve(tags[0].name);
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

function findInstallDir(): string | null {
  // Check common locations
  const locations = [
    // Global npm
    path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'node_modules', NPM_PACKAGE),
    path.join('/usr', 'local', 'lib', 'node_modules', NPM_PACKAGE),
    path.join('/usr', 'lib', 'node_modules', NPM_PACKAGE),
    // Local development
    path.join(os.homedir(), '.openclaw', 'workspace', 'kit-project', 'k.i.t.-bot'),
    // Current working directory
    process.cwd(),
  ];
  
  for (const loc of locations) {
    if (fs.existsSync(path.join(loc, 'package.json'))) {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(loc, 'package.json'), 'utf8'));
        if (pkg.name === NPM_PACKAGE || pkg.name === 'k.i.t.-bot') {
          return loc;
        }
      } catch {
        continue;
      }
    }
  }
  
  return null;
}
