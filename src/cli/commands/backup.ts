/**
 * K.I.T. Backup CLI Command
 * 
 * Backup and restore K.I.T. configuration.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Command } from 'commander';

const KIT_HOME = path.join(os.homedir(), '.kit');
const BACKUP_DIR = path.join(KIT_HOME, 'backups');

export function registerBackupCommand(program: Command): void {
  const backup = program
    .command('backup')
    .description('Backup and restore K.I.T. configuration');

  // Create backup
  backup
    .command('create')
    .alias('save')
    .description('Create a backup of current configuration')
    .option('--name <name>', 'Backup name')
    .option('--include-sessions', 'Include session data')
    .action((options) => {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = options.name || `backup-${timestamp}`;
      const backupPath = path.join(BACKUP_DIR, `${backupName}.json`);
      
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      
      // Collect all config files
      const backup: any = {
        version: '2.0.0',
        createdAt: new Date().toISOString(),
        name: backupName,
        data: {},
      };
      
      const filesToBackup = [
        'config.json',
        'alerts.json',
        'watchlist.json',
        'signals.json',
        'risk-config.json',
        'cron.json',
      ];
      
      for (const file of filesToBackup) {
        const filePath = path.join(KIT_HOME, file);
        if (fs.existsSync(filePath)) {
          try {
            backup.data[file] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          } catch {
            // Skip invalid files
          }
        }
      }
      
      // Include workspace files
      const workspaceDir = path.join(KIT_HOME, 'workspace');
      if (fs.existsSync(workspaceDir)) {
        backup.workspace = {};
        const workspaceFiles = ['SOUL.md', 'USER.md', 'AGENTS.md', 'TOOLS.md', 'MEMORY.md'];
        for (const file of workspaceFiles) {
          const filePath = path.join(workspaceDir, file);
          if (fs.existsSync(filePath)) {
            backup.workspace[file] = fs.readFileSync(filePath, 'utf8');
          }
        }
      }
      
      fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
      
      const size = fs.statSync(backupPath).size;
      console.log(`✅ Backup created: ${backupName}`);
      console.log(`   Path: ${backupPath}`);
      console.log(`   Size: ${formatSize(size)}`);
      console.log(`   Files: ${Object.keys(backup.data).length} configs`);
      if (backup.workspace) {
        console.log(`   Workspace: ${Object.keys(backup.workspace).length} files`);
      }
    });

  // List backups
  backup
    .command('list')
    .alias('ls')
    .description('List available backups')
    .option('--json', 'Output as JSON')
    .action((options) => {
      if (!fs.existsSync(BACKUP_DIR)) {
        console.log('No backups found.');
        console.log('\n💡 Create a backup: kit backup create');
        return;
      }
      
      const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json'));
      
      if (files.length === 0) {
        console.log('No backups found.');
        return;
      }
      
      const backups = files.map(file => {
        const filePath = path.join(BACKUP_DIR, file);
        const stat = fs.statSync(filePath);
        let meta: any = { name: file.replace('.json', '') };
        
        try {
          const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          meta.createdAt = content.createdAt;
          meta.version = content.version;
          meta.configCount = Object.keys(content.data || {}).length;
        } catch {
          meta.createdAt = stat.mtime.toISOString();
        }
        
        meta.size = stat.size;
        return meta;
      });
      
      // Sort by date descending
      backups.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      if (options.json) {
        console.log(JSON.stringify(backups, null, 2));
        return;
      }
      
      console.log('📦 Available Backups\n');
      
      for (const b of backups) {
        const date = new Date(b.createdAt).toLocaleString();
        console.log(`  ${b.name}`);
        console.log(`    Created: ${date}`);
        console.log(`    Size: ${formatSize(b.size)} | Configs: ${b.configCount || '?'}`);
        console.log('');
      }
    });

  // Restore backup
  backup
    .command('restore <name>')
    .description('Restore from a backup')
    .option('--dry-run', 'Show what would be restored without making changes')
    .option('--confirm', 'Skip confirmation prompt')
    .action((name, options) => {
      const backupPath = path.join(BACKUP_DIR, `${name}.json`);
      
      if (!fs.existsSync(backupPath)) {
        console.error(`Backup not found: ${name}`);
        process.exit(1);
      }
      
      const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
      
      console.log(`📦 Restoring: ${name}\n`);
      console.log(`Created: ${backup.createdAt}`);
      console.log(`Version: ${backup.version || 'Unknown'}\n`);
      
      console.log('Files to restore:');
      for (const file of Object.keys(backup.data || {})) {
        console.log(`  ✓ ${file}`);
      }
      if (backup.workspace) {
        console.log('\nWorkspace files:');
        for (const file of Object.keys(backup.workspace)) {
          console.log(`  ✓ ${file}`);
        }
      }
      
      if (options.dryRun) {
        console.log('\n[Dry run - no changes made]');
        return;
      }
      
      if (!options.confirm) {
        console.log('\n⚠️ This will overwrite current configuration!');
        console.log('   Use --confirm to proceed.');
        return;
      }
      
      // Restore config files
      for (const [file, data] of Object.entries(backup.data || {})) {
        const filePath = path.join(KIT_HOME, file);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      }
      
      // Restore workspace files
      if (backup.workspace) {
        const workspaceDir = path.join(KIT_HOME, 'workspace');
        fs.mkdirSync(workspaceDir, { recursive: true });
        
        for (const [file, content] of Object.entries(backup.workspace)) {
          const filePath = path.join(workspaceDir, file);
          fs.writeFileSync(filePath, content as string);
        }
      }
      
      console.log('\n✅ Backup restored successfully!');
      console.log('💡 Restart K.I.T. to apply changes: kit start');
    });

  // Delete backup
  backup
    .command('delete <name>')
    .alias('rm')
    .description('Delete a backup')
    .action((name) => {
      const backupPath = path.join(BACKUP_DIR, `${name}.json`);
      
      if (!fs.existsSync(backupPath)) {
        console.error(`Backup not found: ${name}`);
        process.exit(1);
      }
      
      fs.unlinkSync(backupPath);
      console.log(`✅ Deleted backup: ${name}`);
    });

  // Export to file
  backup
    .command('export <file>')
    .description('Export backup to external file')
    .option('--name <name>', 'Specific backup to export (default: create new)')
    .action((file, options) => {
      let backupPath: string;
      
      if (options.name) {
        backupPath = path.join(BACKUP_DIR, `${options.name}.json`);
        if (!fs.existsSync(backupPath)) {
          console.error(`Backup not found: ${options.name}`);
          process.exit(1);
        }
      } else {
        // Create temporary backup
        const tempName = `export-${Date.now()}`;
        backupPath = path.join(BACKUP_DIR, `${tempName}.json`);
        
        // Same logic as create...
        const backup: any = {
          version: '2.0.0',
          createdAt: new Date().toISOString(),
          data: {},
        };
        
        const filesToBackup = ['config.json', 'alerts.json', 'watchlist.json', 'signals.json'];
        for (const f of filesToBackup) {
          const fp = path.join(KIT_HOME, f);
          if (fs.existsSync(fp)) {
            try { backup.data[f] = JSON.parse(fs.readFileSync(fp, 'utf8')); } catch {}
          }
        }
        
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
        fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
      }
      
      fs.copyFileSync(backupPath, file);
      console.log(`✅ Exported to: ${file}`);
    });

  // Import from file
  backup
    .command('import <file>')
    .description('Import backup from external file')
    .action((file) => {
      if (!fs.existsSync(file)) {
        console.error(`File not found: ${file}`);
        process.exit(1);
      }
      
      const content = JSON.parse(fs.readFileSync(file, 'utf8'));
      const name = content.name || `import-${Date.now()}`;
      const backupPath = path.join(BACKUP_DIR, `${name}.json`);
      
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      fs.writeFileSync(backupPath, JSON.stringify(content, null, 2));
      
      console.log(`✅ Imported backup: ${name}`);
      console.log('💡 Restore with: kit backup restore ' + name);
    });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
